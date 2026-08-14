import { type NextRequest } from 'next/server';
import {
  storeFile,
  isAllowedUploadMime,
  withinUploadSizeLimit,
  MAX_UPLOAD_BYTES,
  unauthorized,
  badRequest,
  validationError,
} from '@researchtrics/core';
import { type FileAccessLevel } from '@researchtrics/db';
import { ok, fail } from '@/lib/api';
import { enforceRateLimit } from '@/lib/rate-limit';
import { getCurrentUser } from '@/lib/current-user';

// File I/O needs the Node runtime (not edge).
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ACCESS_LEVELS: ReadonlySet<FileAccessLevel> = new Set([
  'public',
  'restricted',
  'request',
  'embargoed',
  'private',
]);

/**
 * Upload a file (Spec §46). Multipart form-data with `file` and optional
 * `accessLevel`. Auth + rate-limited; MIME allow-list, size cap, and image-only
 * PDF rejection are enforced in `storeFile`. The bytes go to object storage
 * (R2 in prod, local-fs in dev); only a reference + metadata is kept in Postgres.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) throw unauthorized('Sign in to upload files');
    await enforceRateLimit('upload', `user:${user.id}`);

    const form = await req.formData().catch(() => {
      throw validationError('Expected multipart form-data');
    });
    const entry = form.get('file');
    if (!(entry instanceof File)) throw validationError('A file field is required');

    const mimeType = entry.type || 'application/octet-stream';
    if (!isAllowedUploadMime(mimeType)) throw badRequest(`Unsupported file type: ${mimeType}`);
    if (entry.size > MAX_UPLOAD_BYTES) {
      throw badRequest(`File exceeds the ${MAX_UPLOAD_BYTES}-byte limit`);
    }

    const rawLevel = String(form.get('accessLevel') ?? 'public') as FileAccessLevel;
    const accessLevel = ACCESS_LEVELS.has(rawLevel) ? rawLevel : 'public';

    const data = new Uint8Array(await entry.arrayBuffer());
    if (!withinUploadSizeLimit(data.length)) throw badRequest('Empty or oversized file');

    const result = await storeFile({
      data,
      filename: entry.name || 'upload',
      mimeType,
      accessLevel,
      uploaderId: user.id,
    });
    return ok(result);
  } catch (err) {
    return fail(err);
  }
}
