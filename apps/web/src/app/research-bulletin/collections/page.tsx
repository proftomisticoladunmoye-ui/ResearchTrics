import type { Metadata } from 'next';
import Link from 'next/link';
import { listCollections, SERIES_NAME } from '@researchtrics/core';
import { Card, Badge } from '@researchtrics/ui';

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.researchtrics.com';

export const metadata: Metadata = {
  title: `Collections & Series — ${SERIES_NAME}`,
  description: 'Curated collections and ordered series of ResearchTrics Research Bulletins — knowledge pathways across research methodology, psychometrics, statistics, AI and more.',
  alternates: { canonical: `${appUrl}/research-bulletin/collections` },
};

export const revalidate = 300;

export default async function CollectionsPage() {
  const collections = await listCollections();
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <nav className="mb-4 text-xs text-rt-muted" aria-label="Breadcrumb">
        <Link href="/research-bulletin" className="hover:underline">Research Bulletin</Link>
        <span className="mx-1">/</span>
        <span>Collections &amp; Series</span>
      </nav>
      <h1 className="text-2xl font-semibold text-rt-text">Collections &amp; Series</h1>
      <p className="mt-1 text-sm text-rt-muted">Curated knowledge pathways through the {SERIES_NAME}.</p>

      {collections.length === 0 ? (
        <Card className="mt-6 p-8 text-center text-sm text-rt-muted">No collections yet.</Card>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {collections.map((c) => (
            <li key={c.slug}>
              <Link href={`/research-bulletin/collections/${c.slug}`} className="block h-full">
                <Card className="flex h-full flex-col p-5 transition hover:border-rt-blue">
                  <Badge variant={c.kind === 'series' ? 'gold' : 'neutral'} className="self-start text-xs">
                    {c.kind === 'series' ? 'Series' : 'Collection'}
                  </Badge>
                  <h2 className="mt-2 text-base font-semibold text-rt-text">{c.title}</h2>
                  {c.description ? <p className="mt-1 line-clamp-3 text-sm text-rt-muted">{c.description}</p> : null}
                  <p className="mt-auto pt-3 text-xs text-rt-muted">{c.count} bulletin{c.count === 1 ? '' : 's'}</p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
