import type { Metadata } from 'next';
import Link from 'next/link';
import { listInstitutions } from '@researchtrics/core';
import { Card, Input, Button } from '@researchtrics/ui';

export const metadata: Metadata = {
  title: 'Institutions',
  description: 'Browse research institutions on ResearchTrics.',
};

export const dynamic = 'force-dynamic';

export default async function InstitutionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const { items, total } = await listInstitutions({ query: q, take: 60 });

  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      <h1 className="text-2xl font-semibold text-rt-text">Institutions</h1>
      <p className="mt-1 text-sm text-rt-muted">{total} institutions</p>

      <form className="mt-6 flex max-w-md gap-2" action="/institutions" method="get">
        <Input name="q" defaultValue={q ?? ''} placeholder="Search institutions…" aria-label="Search institutions" />
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      {items.length === 0 ? (
        <p className="mt-10 text-rt-muted">No institutions found.</p>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((i) => (
            <li key={i.id}>
              <Link href={`/institutions/${i.slug}`}>
                <Card className="p-5 transition-colors hover:bg-rt-blue-light">
                  <p className="font-semibold text-rt-text">{i.name}</p>
                  <p className="mt-1 text-sm text-rt-muted">
                    {[i.city, i.country].filter(Boolean).join(', ') || i.type || 'Institution'}
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
