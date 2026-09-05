import { listPublishedBulletins, SERIES_NAME, seriesConfig } from '@researchtrics/core';

export const dynamic = 'force-dynamic';

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.researchtrics.com';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

/**
 * RSS 2.0 feed of published Research Bulletins (§48) — lets researchers and
 * institutional tools subscribe to new publications. Published content only.
 */
export async function GET(): Promise<Response> {
  const { items } = await listPublishedBulletins({ take: 50 });
  const series = seriesConfig();
  const self = `${appUrl}/research-bulletin/feed.xml`;

  const entries = items
    .map((b) => {
      const link = `${appUrl}/research-bulletin/${b.slug}`;
      const authors = b.authors.map((a) => a.name).join(', ');
      const date = (b.publicationDate ?? new Date()).toUTCString();
      const cats = [b.category, ...b.keywords].map((c) => `    <category>${esc(c)}</category>`).join('\n');
      return `  <item>
    <title>${esc(b.number != null ? `No. ${String(b.number).padStart(3, '0')}: ${b.title}` : b.title)}</title>
    <link>${esc(link)}</link>
    <guid isPermaLink="true">${esc(link)}</guid>
    <pubDate>${date}</pubDate>
    <dc:creator>${esc(authors || 'ResearchTrics')}</dc:creator>
    <description>${esc(b.abstract)}</description>
${cats}
  </item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>${esc(SERIES_NAME)}</title>
  <link>${appUrl}/research-bulletin</link>
  <atom:link href="${self}" rel="self" type="application/rss+xml" />
  <description>${esc(series.description)}</description>
  <language>${esc(series.language)}</language>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${entries}
</channel>
</rss>`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8', 'Cache-Control': 'public, max-age=1800' },
  });
}
