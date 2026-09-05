import { type NextRequest } from 'next/server';
import { getPublishedBulletinBySlug, bulletinCitation, CITATION_FORMATS, type CitationFormat } from '@researchtrics/core';

export const dynamic = 'force-dynamic';

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.researchtrics.com';

/**
 * Download a published bulletin's citation in a scholarly format (BibTeX/RIS/
 * APA/…). Public — citation is part of the open scholarly record (§18).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const format = (req.nextUrl.searchParams.get('format') ?? 'apa') as CitationFormat;
  if (!CITATION_FORMATS[format]) {
    return new Response('Unsupported citation format', { status: 400 });
  }
  const b = await getPublishedBulletinBySlug(slug);
  if (!b) return new Response('Not found', { status: 404 });

  const meta = CITATION_FORMATS[format];
  const body = bulletinCitation(b, appUrl, format);
  const filename = `research-bulletin-${b.number ?? b.slug}.${meta.extension}`;
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': `${meta.mime}; charset=utf-8`,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
