import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCollectionBySlug, SERIES_NAME } from '@researchtrics/core';
import { Card, Badge } from '@researchtrics/ui';

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.researchtrics.com';

export const revalidate = 300;

function num(n: number | null): string {
  return n == null ? '—' : String(n).padStart(3, '0');
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const c = await getCollectionBySlug(slug);
  if (!c) return { title: 'Collection', robots: { index: false, follow: false } };
  const url = `${appUrl}/research-bulletin/collections/${c.slug}`;
  return {
    title: `${c.title} — ${SERIES_NAME}`,
    description: c.description ?? `A curated ${c.kind} of ResearchTrics Research Bulletins.`,
    alternates: { canonical: url },
    openGraph: { type: 'website', title: c.title, url, siteName: 'ResearchTrics' },
  };
}

export default async function CollectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = await getCollectionBySlug(slug);
  if (!c) notFound();
  const ordered = c.kind === 'series';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Collection',
    name: c.title,
    ...(c.description ? { description: c.description } : {}),
    url: `${appUrl}/research-bulletin/collections/${c.slug}`,
    hasPart: c.bulletins.map((b) => ({ '@type': 'ScholarlyArticle', headline: b.title, url: `${appUrl}/research-bulletin/${b.slug}` })),
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <nav className="mb-4 text-xs text-rt-muted" aria-label="Breadcrumb">
        <Link href="/research-bulletin" className="hover:underline">Research Bulletin</Link>
        <span className="mx-1">/</span>
        <Link href="/research-bulletin/collections" className="hover:underline">Collections</Link>
      </nav>

      <Badge variant={ordered ? 'gold' : 'neutral'}>{ordered ? 'Series' : 'Collection'}</Badge>
      <h1 className="mt-2 text-2xl font-semibold text-rt-text">{c.title}</h1>
      {c.description ? <p className="mt-2 text-sm leading-relaxed text-rt-muted">{c.description}</p> : null}
      <p className="mt-2 text-xs text-rt-muted">{c.bulletins.length} bulletin{c.bulletins.length === 1 ? '' : 's'}</p>

      {c.bulletins.length === 0 ? (
        <Card className="mt-6 p-8 text-center text-sm text-rt-muted">No published bulletins in this {c.kind} yet.</Card>
      ) : (
        <ol className="mt-6 space-y-3">
          {c.bulletins.map((b, i) => (
            <li key={b.slug}>
              <Link href={`/research-bulletin/${b.slug}`} className="block">
                <Card className="flex gap-3 p-4 transition hover:border-rt-blue">
                  {ordered ? <span className="shrink-0 text-lg font-semibold text-rt-muted">{i + 1}</span> : null}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="gold" className="font-mono text-xs">No. {num(b.number)}</Badge>
                      <span className="text-xs text-rt-muted">{b.category}</span>
                    </div>
                    <h2 className="mt-1 text-base font-semibold text-rt-text">{b.title}</h2>
                    <p className="mt-1 line-clamp-2 text-sm text-rt-muted">{b.abstract}</p>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
