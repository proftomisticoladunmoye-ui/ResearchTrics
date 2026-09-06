import type { Metadata } from 'next';
import Link from 'next/link';
import {
  listPublishedBulletins,
  listBulletinCategories,
  mostViewedBulletins,
  mostCitedBulletins,
  BULLETIN_TYPES,
  BULLETIN_TYPE_LABELS,
  SERIES_NAME,
  type BulletinType,
} from '@researchtrics/core';
import { Card, Badge } from '@researchtrics/ui';

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.researchtrics.com';

export const metadata: Metadata = {
  title: `${SERIES_NAME} — scholarly research communication`,
  description:
    'ResearchTrics Research Bulletin is a scholarly research communication series providing accessible, evidence-based insights into research methodology, psychometrics, statistics, artificial intelligence, research technology and emerging developments in knowledge production.',
  alternates: {
    canonical: `${appUrl}/research-bulletin`,
    types: { 'application/rss+xml': `${appUrl}/research-bulletin/feed.xml` },
  },
  openGraph: {
    type: 'website',
    title: SERIES_NAME,
    description: 'Accessible, evidence-based scholarly research communication.',
    url: `${appUrl}/research-bulletin`,
    siteName: 'ResearchTrics',
  },
};

export const revalidate = 300;

function num(n: number | null): string {
  return n == null ? '—' : String(n).padStart(3, '0');
}

export default async function BulletinHubPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; category?: string }>;
}) {
  const sp = await searchParams;
  const type = BULLETIN_TYPES.includes(sp.type as BulletinType) ? (sp.type as BulletinType) : undefined;
  const query = sp.q?.trim() || undefined;
  const category = sp.category?.trim() || undefined;

  const browsing = !query && !type && !category;
  const [{ items, total }, categories, mostRead, mostCited] = await Promise.all([
    listPublishedBulletins({ query, type, category, take: 50 }),
    listBulletinCategories(),
    browsing ? mostViewedBulletins(5) : Promise.resolve([]),
    browsing ? mostCitedBulletins(5) : Promise.resolve([]),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <header className="border-b border-rt-border pb-6">
        <Badge variant="gold" className="font-mono">{SERIES_NAME}</Badge>
        <h1 className="mt-3 text-3xl font-semibold text-rt-text">ResearchTrics Research Bulletin</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-rt-muted">
          A scholarly research communication series providing accessible, evidence-based insights into research
          methodology, psychometrics, statistics, artificial intelligence, research technology and emerging developments
          in knowledge production. Every bulletin is freely readable, citable, and permanently archived.
        </p>
      </header>

      {/* Search + filters (GET form — crawlable, no client JS needed) */}
      <form className="mt-6 flex flex-wrap items-end gap-3" action="/research-bulletin" method="get">
        <label className="flex-1 min-w-[220px]">
          <span className="mb-1 block text-xs font-medium text-rt-muted">Search</span>
          <input
            name="q"
            defaultValue={query ?? ''}
            placeholder="Title, abstract, keyword…"
            className="w-full rounded-lg border border-rt-border bg-rt-white px-3 py-2 text-sm text-rt-text"
          />
        </label>
        <label>
          <span className="mb-1 block text-xs font-medium text-rt-muted">Type</span>
          <select name="type" defaultValue={type ?? ''} className="rounded-lg border border-rt-border bg-rt-white p-2 text-sm text-rt-text">
            <option value="">All types</option>
            {BULLETIN_TYPES.map((t) => (
              <option key={t} value={t}>{BULLETIN_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </label>
        {categories.length > 0 ? (
          <label>
            <span className="mb-1 block text-xs font-medium text-rt-muted">Category</span>
            <select name="category" defaultValue={category ?? ''} className="rounded-lg border border-rt-border bg-rt-white p-2 text-sm text-rt-text">
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
        ) : null}
        <button type="submit" className="rounded-lg bg-rt-blue px-4 py-2 text-sm font-medium text-white">Filter</button>
      </form>

      {browsing && (mostRead.length > 0 || mostCited.length > 0) ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {mostRead.length > 0 ? (
            <Card className="p-4">
              <h2 className="text-sm font-semibold text-rt-text">Most read</h2>
              <ol className="mt-2 space-y-1 text-sm">
                {mostRead.map((b) => (
                  <li key={b.slug} className="truncate">
                    <Link href={`/research-bulletin/${b.slug}`} className="text-rt-blue hover:underline">
                      No. {num(b.number)} · {b.title}
                    </Link>
                  </li>
                ))}
              </ol>
            </Card>
          ) : null}
          {mostCited.length > 0 ? (
            <Card className="p-4">
              <h2 className="text-sm font-semibold text-rt-text">Most cited</h2>
              <ol className="mt-2 space-y-1 text-sm">
                {mostCited.map((c) => (
                  <li key={c.bulletin.slug} className="flex justify-between gap-2">
                    <Link href={`/research-bulletin/${c.bulletin.slug}`} className="min-w-0 truncate text-rt-blue hover:underline">
                      No. {num(c.bulletin.number)} · {c.bulletin.title}
                    </Link>
                    <span className="shrink-0 text-xs text-rt-muted">{c.citations}×</span>
                  </li>
                ))}
              </ol>
            </Card>
          ) : null}
        </div>
      ) : null}

      <p className="mt-4 text-xs text-rt-muted">{total} bulletin{total === 1 ? '' : 's'}</p>

      {items.length === 0 ? (
        <Card className="mt-4 p-8 text-center text-sm text-rt-muted">
          No bulletins published yet. Check back soon.
        </Card>
      ) : (
        <ul className="mt-4 grid gap-4 sm:grid-cols-2">
          {items.map((b) => (
            <li key={b.slug}>
              <Link href={`/research-bulletin/${b.slug}`} className="block h-full">
                <Card className="flex h-full flex-col p-5 transition hover:border-rt-blue">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="gold" className="font-mono text-xs">No. {num(b.number)}</Badge>
                    <Badge variant="neutral" className="text-xs">{BULLETIN_TYPE_LABELS[b.type]}</Badge>
                  </div>
                  <h2 className="mt-2 text-base font-semibold leading-snug text-rt-text">{b.title}</h2>
                  {b.subtitle ? <p className="mt-1 text-sm text-rt-muted">{b.subtitle}</p> : null}
                  <p className="mt-2 line-clamp-3 text-sm text-rt-muted">{b.abstract}</p>
                  <p className="mt-auto pt-3 text-xs text-rt-muted">
                    {b.authors.map((a) => a.name).join(', ') || 'ResearchTrics'}
                    {b.publicationDate ? ` · ${b.publicationDate.getUTCFullYear()}` : ''}
                    {` · ${b.category}`}
                  </p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
