import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { prisma, type PrismaClient, type FileAccessLevel } from '@researchtrics/db';
import { badRequest } from './errors';

/**
 * File storage (Spec §46). Object-storage refs only — never blobs in Postgres.
 * A provider abstraction keeps the app decoupled from S3/MinIO; a local-fs
 * provider is used for development without object storage.
 *
 * Pure validation helpers (MIME allowlist, checksum, PDF text heuristic) are
 * separated so they can be unit-tested without a filesystem.
 */

/** Allowed upload MIME types (Spec §35 secure upload / MIME validation). */
export const ALLOWED_UPLOAD_MIME: ReadonlySet<string> = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'text/csv',
  'application/zip',
  'application/json',
]);

export function isAllowedUploadMime(mime: string): boolean {
  return ALLOWED_UPLOAD_MIME.has(mime);
}

export function sha256(data: Uint8Array): string {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Heuristic: does this PDF contain extractable text (Spec §11)? Image-only PDFs
 * must be rejected for scholarly indexing. Looks for a %PDF header plus text
 * operators / font resources. Not a full parser — a fast pre-check.
 */
export function pdfLikelyHasText(data: Uint8Array): boolean {
  if (data.length < 5) return false;
  const header = Buffer.from(data.subarray(0, 5)).toString('latin1');
  if (!header.startsWith('%PDF-')) return false;
  const body = Buffer.from(data).toString('latin1');
  const hasTextOps = /\bBT\b[\s\S]*?\bET\b/.test(body);
  const hasFonts = /\/Font\b/.test(body) || /\/Type0\b/.test(body) || /\/TrueType\b/.test(body);
  return hasTextOps || hasFonts;
}

export interface StorageProvider {
  /** Persist bytes under `key`. */
  put(key: string, data: Uint8Array, contentType: string): Promise<void>;
  /** A resolvable URL/reference for the stored object. */
  urlFor(key: string): string;
  readonly name: string;
}

/** Development provider: writes under a local data directory. */
export class LocalFsStorageProvider implements StorageProvider {
  readonly name = 'local';
  constructor(private readonly root: string = process.env.LOCAL_STORAGE_DIR ?? '.storage') {}

  async put(key: string, data: Uint8Array): Promise<void> {
    const path = join(this.root, key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, data);
  }

  urlFor(key: string): string {
    return `/api/v1/files/${key}`;
  }
}

let provider: StorageProvider = new LocalFsStorageProvider();

export function setStorageProvider(next: StorageProvider): void {
  provider = next;
}
export function getStorageProvider(): StorageProvider {
  return provider;
}

export interface StoreFileInput {
  data: Uint8Array;
  filename: string;
  mimeType: string;
  accessLevel?: FileAccessLevel;
  licenseCode?: string | null;
  uploaderId?: string | null;
}

/**
 * Validate + persist an uploaded file and record its metadata. Rejects
 * disallowed MIME types and image-only PDFs (Spec §11, §35, §46).
 */
export async function storeFile(
  input: StoreFileInput,
  client: PrismaClient = prisma,
): Promise<{ id: string; storageKey: string; url: string; pdfHasText: boolean | null }> {
  if (!isAllowedUploadMime(input.mimeType)) {
    throw badRequest(`Unsupported file type: ${input.mimeType}`);
  }
  const checksum = sha256(input.data);

  let pdfHasText: boolean | null = null;
  if (input.mimeType === 'application/pdf') {
    pdfHasText = pdfLikelyHasText(input.data);
    if (!pdfHasText) {
      throw badRequest('PDF appears to be image-only (no extractable text). See Google Scholar requirements.');
    }
  }

  const storageKey = `${checksum.slice(0, 2)}/${checksum}`;
  await getStorageProvider().put(storageKey, input.data, input.mimeType);

  const file = await client.file.create({
    data: {
      storageKey,
      filename: input.filename,
      mimeType: input.mimeType,
      sizeBytes: input.data.length,
      checksumSha256: checksum,
      accessLevel: input.accessLevel ?? 'public',
      licenseCode: input.licenseCode ?? null,
      pdfHasText,
      uploaderId: input.uploaderId ?? null,
    },
  });

  return { id: file.id, storageKey, url: getStorageProvider().urlFor(storageKey), pdfHasText };
}
