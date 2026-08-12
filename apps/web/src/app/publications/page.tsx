import type { Metadata } from 'next';
import Link from 'next/link';
import { listPublications } from '@researchtrics/core';
import { Card, Input, Button, Badge } from '@researchtrics/ui';

export const metadata: Metadata = {
  title: 'Publications',
  description: 'Browse scholarly publications on ResearchTrics.',
};

export const dynamic = 'force-dynamic';

export default async function PublicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page } = await searchParams;
  const take = 20;
  const current = Math.max(1, Number(page ?? '1') || 1);
  const { items, total } = await listPublications({ query: q, take, skip: (current - 1) * take });
  const pages = Math.max(1, Math.ceil(total / take));

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-2xl font-semibold text-rt-text">Publications</h1>
      <p className="mt-1 text-sm text-rt-muted">{total} publications</p>

      <form className="mt-6 flex max-w-md gap-2" action="/publications" method="get">
        <Input name="q" defaultValue={q ?? ''} placeholder="Search titles…" aria-label="Search publications" />
        <Button type="submit" variant="secondary">Search</Button>
      </form>

      {items.length === 0 ? (
        <p className="mt-10 text-rt-muted">No publications yet. Import one by DOI from your dashboard.</p>
      ) : (
        <ul className="mt-8 space-y-4">
          {items.map((p) => (
            <li key={p.id}>
              <Card className="p-5">
                <Link href={`/publications/${p.slug}`} className="text-lg font-semibold text-rt-blue hover:underline">
                  {p.title}
                </Link>
                <p className="mt-1 text-sm text-rt-muted">
                  {p.authors.map((a) => a.rawName).slice(0, 6).join(', ')}
                  {p.authors.length > 6 ? ' et al.' : ''}
                </p>
                <p className="mt-1 text-sm text-rt-muted">
                  {p.journal?.name ? `${p.journal.name} · ` : ''}
                  {p.publishedYear ?? ''}
                </p>
                {p.openAccess ? (
                  <div className="mt-2">
                    <Badge variant="success">Open Access</Badge>
                  </div>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      )}

      {pages > 1 ? (
        <nav className="mt-8 flex items-center gap-3 text-sm" aria-label="Pagination">
          {current > 1 ? (
            <Link className="text-rt-blue hover:underline" href={`/publications?${new URLSearchParams({ ...(q ? { q } : {}), page: String(current - 1) })}`}>
              Previous
            </Link>
          ) : null}
          <span className="text-rt-muted">Page {current} of {pages}</span>
          {current < pages ? (
            <Link className="text-rt-blue hover:underline" href={`/publications?${new URLSearchParams({ ...(q ? { q } : {}), page: String(current + 1) })}`}>
              Next
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
