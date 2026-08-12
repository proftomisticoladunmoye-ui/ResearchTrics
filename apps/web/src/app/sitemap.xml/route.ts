import { NextResponse } from 'next/server';
import { SITEMAP_TYPES, renderSitemapIndex, XML_HEADERS } from '@/lib/sitemap';

export const dynamic = 'force-dynamic';

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

/** Sitemap index → per-type sitemaps (Spec §42, §71). */
export function GET(): NextResponse {
  const locs = SITEMAP_TYPES.map((t) => `${appUrl}/sitemaps/${t}`);
  return new NextResponse(renderSitemapIndex(locs), { headers: XML_HEADERS });
}
