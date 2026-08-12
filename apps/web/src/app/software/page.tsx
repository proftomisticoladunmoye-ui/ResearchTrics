import type { Metadata } from 'next';
import Link from 'next/link';
import { listSoftware } from '@researchtrics/core';
import { Card } from '@researchtrics/ui';

export const metadata: Metadata = {
  title: 'Research Software',
  description: 'Research software, packages and code on ResearchTrics.',
};

export const dynamic = 'force-dynamic';

export default async function SoftwareListPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const { items, total } = await listSoftware({ query: q, take: 40 });

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-2xl font-semibold text-rt-text">Research Software</h1>
      <p className="mt-1 text-sm text-rt-muted">{total} packages</p>
      {items.length === 0 ? (
        <p className="mt-8 text-rt-muted">No software registered yet.</p>
      ) : (
        <ul className="mt-8 space-y-3">
          {items.map((s) => (
            <li key={s.id}>
              <Card className="p-5">
                <Link href={`/software/${s.slug}`} className="font-semibold text-rt-blue hover:underline">
                  {s.name}
                </Link>
                {s.version ? <span className="ml-2 text-sm text-rt-muted">v{s.version}</span> : null}
                {s.description ? <p className="mt-1 text-sm text-rt-muted">{s.description}</p> : null}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
