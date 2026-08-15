import { createHash } from 'node:crypto';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { prisma, type PrismaClient, type FileAccessLevel } from '@researchtrics/db';
import { badRequest } from './errors';

/** Maximum upload size (Spec §35, §46). 25 MB — generous for PDFs/datasets. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export function withinUploadSizeLimit(byteLength: number): boolean {
  return byteLength > 0 && byteLength <= MAX_UPLOAD_BYTES;
}

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
  /** Read bytes back, or null if absent (used to stream local files). */
  read?(key: string): Promise<Uint8Array | null>;
  /**
   * A time-limited direct URL for the object, or null if the provider can't
   * issue one (local-fs). Used to offload downloads to the object store.
   */
  signedUrl?(key: string, expiresInSeconds?: number): Promise<string | null>;
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

  async read(key: string): Promise<Uint8Array | null> {
    try {
      return new Uint8Array(await readFile(join(this.root, key)));
    } catch {
      return null;
    }
  }

  urlFor(key: string): string {
    return `/api/v1/files/${key}`;
  }
}

let provider: StorageProvider | null = null;

/**
 * Env-based provider selector. Defaults to local-fs; the S3/R2 module registers
 * its own factory ({@link storageFromEnv}) when it loads, so storage.ts never
 * has to import the object-storage SDK directly (no import cycle, no SDK in an
 * edge/client bundle).
 */
let envFactory: () => StorageProvider = () => new LocalFsStorageProvider();

export function registerStorageEnvFactory(factory: () => StorageProvider): void {
  envFactory = factory;
}

function selectProviderFromEnv(): StorageProvider {
  return envFactory();
}

export function setStorageProvider(next: StorageProvider): void {
  provider = next;
}

/**
 * The active storage provider. Selected lazily on first use from the
 * environment (S3/R2 when configured, else local-fs) — this runs only in
 * server code paths that persist files, so no edge/client bundle ever pulls in
 * the object-storage SDK. `setStorageProvider` overrides it (e.g. tests).
 */
export function getStorageProvider(): StorageProvider {
  if (!provider) {
    // Lazy require avoids a static storage → storage-s3 → storage cycle at
    // module-eval time; by call time both modules are fully initialized.
    provider = selectProviderFromEnv();
  }
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
  if (!withinUploadSizeLimit(input.data.length)) {
    throw badRequest(`File must be between 1 byte and ${MAX_UPLOAD_BYTES} bytes`);
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

export interface UploadedFileSummary {
  id: string;
  storageKey: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  accessLevel: FileAccessLevel;
  url: string;
  createdAt: Date;
}

/** A researcher's own uploaded files, newest first (dashboard listing). */
export async function listFilesByUploader(
  uploaderId: string,
  client: PrismaClient = prisma,
): Promise<UploadedFileSummary[]> {
  const files = await client.file.findMany({
    where: { uploaderId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  const provider = getStorageProvider();
  return files.map((f) => ({
    id: f.id,
    storageKey: f.storageKey,
    filename: f.filename,
    mimeType: f.mimeType,
    sizeBytes: f.sizeBytes,
    accessLevel: f.accessLevel,
    url: provider.urlFor(f.storageKey),
    createdAt: f.createdAt,
  }));
}

export interface ServableFile {
  storageKey: string;
  filename: string;
  mimeType: string;
  accessLevel: FileAccessLevel;
  uploaderId: string | null;
}

/** Metadata needed to authorize + serve a stored object (Spec §36, §46). */
export async function getFileForServe(
  storageKey: string,
  client: PrismaClient = prisma,
): Promise<ServableFile | null> {
  const file = await client.file.findUnique({
    where: { storageKey },
    select: { storageKey: true, filename: true, mimeType: true, accessLevel: true, uploaderId: true },
  });
  return file;
}

/**
 * Decide whether `user` may read a file at `accessLevel` (Spec §36).
 * - public: anyone.
 * - restricted / request: any authenticated user (a formal request/approval
 *   flow for `request` is a documented follow-up).
 * - embargoed / private: only the uploader (no embargo-expiry field yet).
 */
export function canAccessFile(
  accessLevel: FileAccessLevel,
  file: { uploaderId: string | null },
  user: { id: string } | null,
): boolean {
  if (accessLevel === 'public') return true;
  if (!user) return false;
  if (accessLevel === 'private' || accessLevel === 'embargoed') {
    return file.uploaderId === user.id;
  }
  // restricted | request
  return true;
}
