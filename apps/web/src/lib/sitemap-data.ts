import { prisma } from '@researchtrics/db';
import { SITEMAP_MAX_URLS, type SitemapType, type SitemapEntry } from './sitemap';

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

/**
 * Build the PUBLIC URL entries for one sitemap type (Spec §42, §71). Shared by
 * the per-type sitemaps and the sitemap index (which derives each child's
 * <lastmod> from these), so the two never drift. Only public, crawlable content
 * is ever included.
 */
export async function buildSitemapEntries(type: SitemapType): Promise<SitemapEntry[]> {
  const take = SITEMAP_MAX_URLS;
  switch (type) {
    case 'researchers': {
      const rows = await prisma.researcher.findMany({
        // Suppressed (removal-requested) and merged (deduplicated) profiles must
        // not be advertised to crawlers.
        where: {
          deletedAt: null,
          profileVisibility: 'public',
          profileStatus: { notIn: ['suppressed', 'merged'] },
        },
        select: { slug: true, updatedAt: true },
        take,
      });
      return rows.map((r) => ({ loc: `${appUrl}/researchers/${r.slug}`, lastmod: r.updatedAt.toISOString() }));
    }
    case 'publications': {
      const rows = await prisma.publication.findMany({
        where: { deletedAt: null, visibility: 'public' },
        select: { slug: true, updatedAt: true },
        take,
      });
      return rows.map((p) => ({ loc: `${appUrl}/publications/${p.slug}`, lastmod: p.updatedAt.toISOString() }));
    }
    case 'institutions': {
      const rows = await prisma.institution.findMany({
        where: { deletedAt: null },
        select: { slug: true, updatedAt: true },
        take,
      });
      return rows.map((i) => ({ loc: `${appUrl}/institutions/${i.slug}`, lastmod: i.updatedAt.toISOString() }));
    }
    case 'journals': {
      const rows = await prisma.journal.findMany({ select: { slug: true, updatedAt: true }, take });
      return rows.map((j) => ({ loc: `${appUrl}/journals/${j.slug}`, lastmod: j.updatedAt.toISOString() }));
    }
    case 'blog': {
      const { listPublishedBlogPosts } = await import('@researchtrics/core');
      const posts = await listPublishedBlogPosts();
      return [
        { loc: `${appUrl}/blog` },
        ...posts.map((p) => ({
          loc: `${appUrl}/blog/${p.slug}`,
          lastmod: (p.publishedAt ?? p.updatedAt).toISOString(),
        })),
      ];
    }
    case 'research-bulletin': {
      const { listPublishedBulletinSlugs, listCollections, listBulletinAuthorSlugs } = await import(
        '@researchtrics/core'
      );
      const [bulletins, collections, authors] = await Promise.all([
        listPublishedBulletinSlugs(),
        listCollections(),
        listBulletinAuthorSlugs(),
      ]);
      return [
        { loc: `${appUrl}/research-bulletin` },
        { loc: `${appUrl}/research-bulletin/collections` },
        ...collections.map((c) => ({ loc: `${appUrl}/research-bulletin/collections/${c.slug}` })),
        // Author landing pages are indexable public pages — include them so they
        // are discoverable, not just reachable via internal links.
        ...authors.map((a) => ({
          loc: `${appUrl}/research-bulletin/authors/${a.slug}`,
          lastmod: a.updatedAt.toISOString(),
        })),
        ...bulletins.map((b) => ({
          loc: `${appUrl}/research-bulletin/${b.slug}`,
          lastmod: b.updatedAt.toISOString(),
        })),
      ];
    }
  }
}

/** The most recent <lastmod> among a set of entries, for the sitemap index. */
export function latestLastmod(entries: SitemapEntry[]): string | undefined {
  let latest: string | undefined;
  for (const e of entries) {
    if (e.lastmod && (!latest || e.lastmod > latest)) latest = e.lastmod;
  }
  return latest;
}
