import type { Metadata } from 'next';
import Link from 'next/link';
import { listDatasets } from '@researchtrics/core';
import { Card, Badge } from '@researchtrics/ui';

export const metadata: Metadata = {
  title: 'Datasets',
  description: 'Browse research datasets on ResearchTrics.',
};

export const dynamic = 'force-dynamic';

export default async function DatasetsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const { items, total } = await listDatasets({ query: q, take: 40 });

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-2xl font-semibold text-rt-text">Datasets</h1>
      <p className="mt-1 text-sm text-rt-muted">{total} datasets</p>
      {items.length === 0 ? (
        <p className="mt-8 text-rt-muted">No datasets yet.</p>
      ) : (
        <ul className="mt-8 space-y-3">
          {items.map((d) => (
            <li key={d.id}>
              <Card className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/datasets/${d.slug}`} className="font-semibold text-rt-blue hover:underline">
                    {d.title}
                  </Link>
                  <Badge variant={d.accessLevel === 'open' ? 'success' : 'warning'}>{d.accessLevel}</Badge>
                </div>
                {d.geography ? <p className="mt-1 text-sm text-rt-muted">{d.geography}</p> : null}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
