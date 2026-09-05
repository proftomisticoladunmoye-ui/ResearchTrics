import { type NextRequest } from 'next/server';
import { getPublishedBulletinBySlug, renderBulletinPdf, incrementBulletinDownload } from '@researchtrics/core';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.researchtrics.com';

/**
 * Publicly downloadable, branded PDF of a published Research Bulletin (§19).
 * Generated on demand from the canonical content and cached at the edge.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const b = await getPublishedBulletinBySlug(slug);
  if (!b) return new Response('Not found', { status: 404 });

  try {
    const pdf = await renderBulletinPdf(b, appUrl);
    void incrementBulletinDownload(b.id);
    const filename = `research-bulletin-${b.number ?? b.slug}.pdf`;
    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'public, max-age=3600, s-maxage=86400',
      },
    });
  } catch {
    return new Response('Could not generate PDF', { status: 500 });
  }
}
