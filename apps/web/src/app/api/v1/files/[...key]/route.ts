import { type NextRequest, NextResponse } from 'next/server';
import {
  getFileForServe,
  canAccessFile,
  getStorageProvider,
  unauthorized,
  forbidden,
  notFound,
  toProblem,
} from '@researchtrics/core';
import { getCurrentUser } from '@/lib/current-user';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Serve a stored object (Spec §36, §46). The storage key contains a `/`, so this
 * is a catch-all. Access is enforced from the File record's `accessLevel` before
 * anything is returned. For object storage that can issue presigned links (R2),
 * we redirect to a short-lived signed URL to offload bandwidth; for local-fs we
 * stream the bytes.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ key: string[] }> }) {
  try {
    const { key } = await params;
    const storageKey = key.join('/');

    const file = await getFileForServe(storageKey);
    if (!file) throw notFound('File not found');

    // Authorize (public files skip the user lookup entirely).
    if (file.accessLevel !== 'public') {
      const user = await getCurrentUser();
      if (!user) throw unauthorized('Sign in to access this file');
      if (!canAccessFile(file.accessLevel, file, user)) {
        throw forbidden('You do not have access to this file');
      }
    }

    const provider = getStorageProvider();

    // Prefer a presigned redirect when the provider can issue one (R2/S3).
    if (provider.signedUrl) {
      const url = await provider.signedUrl(storageKey, 300);
      if (url) return NextResponse.redirect(url, 307);
    }

    // Otherwise stream the bytes (local-fs).
    if (provider.read) {
      const bytes = await provider.read(storageKey);
      if (!bytes) throw notFound('File not found');
      const safeName = file.filename.replace(/[^\w.-]/g, '_');
      return new NextResponse(Buffer.from(bytes), {
        status: 200,
        headers: {
          'Content-Type': file.mimeType,
          'Content-Disposition': `inline; filename="${safeName}"`,
          'Content-Length': String(bytes.length),
          'Cache-Control': file.accessLevel === 'public' ? 'public, max-age=3600' : 'private, no-store',
        },
      });
    }

    throw notFound('File not found');
  } catch (err) {
    const problem = toProblem(err);
    return NextResponse.json(problem.body, { status: problem.status });
  }
}
