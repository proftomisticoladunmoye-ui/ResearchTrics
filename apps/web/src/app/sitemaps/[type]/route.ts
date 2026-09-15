import { NextResponse, type NextRequest } from 'next/server';
import { SITEMAP_TYPES, renderUrlset, XML_HEADERS, type SitemapType } from '@/lib/sitemap';
import { buildSitemapEntries } from '@/lib/sitemap-data';

export const dynamic = 'force-dynamic';

/** Per-type sitemap of PUBLIC content only (Spec §42, §71). */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ type: string }> },
): Promise<NextResponse> {
  const { type } = await params;
  if (!SITEMAP_TYPES.includes(type as SitemapType)) {
    return new NextResponse('Not found', { status: 404 });
  }

  const entries = await buildSitemapEntries(type as SitemapType);
  return new NextResponse(renderUrlset(entries), { headers: XML_HEADERS });
}
