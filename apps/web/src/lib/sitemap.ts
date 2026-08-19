/** XML sitemap helpers (Spec §42, §71). Only public content is ever included. */

export const SITEMAP_TYPES = ['researchers', 'publications', 'institutions', 'journals', 'blog'] as const;
export type SitemapType = (typeof SITEMAP_TYPES)[number];

export const SITEMAP_MAX_URLS = 5000; // shard beyond this in a later ops pass

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export interface SitemapEntry {
  loc: string;
  lastmod?: string | undefined;
}

export function renderUrlset(entries: SitemapEntry[]): string {
  const body = entries
    .map((e) => {
      const lastmod = e.lastmod ? `\n    <lastmod>${xmlEscape(e.lastmod)}</lastmod>` : '';
      return `  <url>\n    <loc>${xmlEscape(e.loc)}</loc>${lastmod}\n  </url>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>`;
}

export function renderSitemapIndex(locs: string[]): string {
  const body = locs.map((loc) => `  <sitemap>\n    <loc>${xmlEscape(loc)}</loc>\n  </sitemap>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</sitemapindex>`;
}

export const XML_HEADERS = {
  'content-type': 'application/xml; charset=utf-8',
  'cache-control': 'public, max-age=3600',
};
