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

    // Public full text (what Google Scholar indexes) is streamed INLINE from this
    // app domain, not redirected off-site. Scholar's crawler is conservative
    // about redirects and off-domain full text, and citation_pdf_url must resolve
    // to the PDF on the same host as the landing page — a 307 to a time-limited,
    // off-domain presigned URL is a known indexing risk. Bytes are cached at the
    // edge, so the app doesn't re-proxy every crawl (Spec §11, §42).
    if (file.accessLevel === 'public' && provider.read) {
      const bytes = await provider.read(storageKey);
      if (!bytes) throw notFound('File not found');
      const safeName = file.filename.replace(/[^\w.-]/g, '_');
      return new NextResponse(Buffer.from(bytes), {
        status: 200,
        headers: {
          'Content-Type': file.mimeType,
          'Content-Disposition': `inline; filename="${safeName}"`,
          'Content-Length': String(bytes.length),
          // Long, immutable cache: the key is a content hash, so bytes never change.
          'Cache-Control': 'public, max-age=86400, s-maxage=604800, immutable',
        },
      });
    }

    // Private/restricted files: offload bandwidth via a short-lived presigned
    // redirect where the provider can issue one (R2/S3); SEO doesn't apply here.
    if (provider.signedUrl) {
      const url = await provider.signedUrl(storageKey, 300);
      if (url) return NextResponse.redirect(url, 307);
    }

    // Fallback: stream the bytes (local-fs, or a provider without presigning).
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
