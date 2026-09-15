import { NextResponse } from 'next/server';
import { SITEMAP_TYPES, renderSitemapIndex, XML_HEADERS, type SitemapEntry } from '@/lib/sitemap';
import { buildSitemapEntries, latestLastmod } from '@/lib/sitemap-data';

export const dynamic = 'force-dynamic';

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

/**
 * Sitemap index → per-type sitemaps (Spec §42, §71). Each child carries a
 * <lastmod> derived from its newest entry, so crawlers know which sitemaps
 * (e.g. the freshly-updated Research Bulletin) to re-fetch and re-index.
 */
export async function GET(): Promise<NextResponse> {
  const entries: SitemapEntry[] = await Promise.all(
    SITEMAP_TYPES.map(async (t) => ({
      loc: `${appUrl}/sitemaps/${t}`,
      lastmod: latestLastmod(await buildSitemapEntries(t)),
    })),
  );
  return new NextResponse(renderSitemapIndex(entries), { headers: XML_HEADERS });
}
