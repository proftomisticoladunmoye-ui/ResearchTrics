import type { Metadata } from 'next';
import Link from 'next/link';
import { listResearchers } from '@researchtrics/core';
import { Card, Avatar, VerificationBadge, Input, Button } from '@researchtrics/ui';

export const metadata: Metadata = {
  title: 'Researchers',
  description: 'Discover researchers on ResearchTrics.',
};

export const dynamic = 'force-dynamic';

export default async function ResearchersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page } = await searchParams;
  const take = 24;
  const current = Math.max(1, Number(page ?? '1') || 1);
  const { items, total } = await listResearchers({
    query: q,
    take,
    skip: (current - 1) * take,
  });
  const pages = Math.max(1, Math.ceil(total / take));

  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      <h1 className="text-2xl font-semibold text-rt-text">Researchers</h1>
      <p className="mt-1 text-sm text-rt-muted">{total} public profiles</p>

      <form className="mt-6 flex max-w-md gap-2" action="/researchers" method="get">
        <Input name="q" defaultValue={q ?? ''} placeholder="Search by name…" aria-label="Search researchers" />
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      {items.length === 0 ? (
        <p className="mt-10 text-rt-muted">No researchers found.</p>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((r) => (
            <li key={r.id}>
              <Link href={`/researchers/${r.slug}`}>
                <Card className="flex items-center gap-4 p-5 transition-colors hover:bg-rt-blue-light">
                  <Avatar name={r.displayName} />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-rt-text">{r.displayName}</p>
                    <p className="truncate text-sm text-rt-muted">
                      {r.academicRank ?? 'Researcher'}
                      {r.country ? ` · ${r.country}` : ''}
                    </p>
                    <div className="mt-1">
                      <VerificationBadge level={r.verificationLevel} />
                    </div>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {pages > 1 ? (
        <nav className="mt-8 flex items-center gap-2" aria-label="Pagination">
          {current > 1 ? (
            <Button asChild variant="secondary" size="sm">
              <Link href={`/researchers?${new URLSearchParams({ ...(q ? { q } : {}), page: String(current - 1) })}`}>
                Previous
              </Link>
            </Button>
          ) : null}
          <span className="text-sm text-rt-muted">
            Page {current} of {pages}
          </span>
          {current < pages ? (
            <Button asChild variant="secondary" size="sm">
              <Link href={`/researchers?${new URLSearchParams({ ...(q ? { q } : {}), page: String(current + 1) })}`}>
                Next
              </Link>
            </Button>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
