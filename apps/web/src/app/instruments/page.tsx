import type { Metadata } from 'next';
import Link from 'next/link';
import { listInstruments } from '@researchtrics/core';
import { Card, Badge } from '@researchtrics/ui';

export const metadata: Metadata = {
  title: 'Research Instruments',
  description: 'Psychometric scales, questionnaires and assessments on ResearchTrics.',
};

export const dynamic = 'force-dynamic';

export default async function InstrumentsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const { items, total } = await listInstruments({ query: q, take: 40 });

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-2xl font-semibold text-rt-text">Research Instruments</h1>
      <p className="mt-1 text-sm text-rt-muted">{total} instruments</p>
      {items.length === 0 ? (
        <p className="mt-8 text-rt-muted">No instruments yet.</p>
      ) : (
        <ul className="mt-8 space-y-3">
          {items.map((i) => (
            <li key={i.id}>
              <Card className="p-5">
                <Link href={`/instruments/${i.slug}`} className="font-semibold text-rt-blue hover:underline">
                  {i.title}
                </Link>
                <div className="mt-1 flex flex-wrap gap-2 text-sm text-rt-muted">
                  {i.construct ? <Badge variant="neutral">{i.construct}</Badge> : null}
                  {i.language ? <span>{i.language}</span> : null}
                  {i.itemCount ? <span>· {i.itemCount} items</span> : null}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
