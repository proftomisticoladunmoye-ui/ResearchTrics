import type { Metadata } from 'next';
import Link from 'next/link';
import { listPublications, getFollowingFeed } from '@researchtrics/core';
import { Card, Input, Button, Badge, Avatar } from '@researchtrics/ui';
import { getCurrentUser } from '@/lib/current-user';

export const metadata: Metadata = {
  title: 'Publications',
  description: 'Browse scholarly publications on ResearchTrics.',
};

export const dynamic = 'force-dynamic';

function humanizeType(t: string): string {
  return t.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

export default async function PublicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page } = await searchParams;
  const take = 20;
  const current = Math.max(1, Number(page ?? '1') || 1);

  const user = await getCurrentUser();
  const [{ items, total }, feed] = await Promise.all([
    listPublications({ query: q, take, skip: (current - 1) * take }),
    user?.researcher && !q && current === 1
      ? getFollowingFeed(user.researcher.id, { take: 4 })
      : Promise.resolve([]),
  ]);
  const pages = Math.max(1, Math.ceil(total / take));

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-2xl font-semibold text-rt-text">Publications</h1>
      <p className="mt-1 text-sm text-rt-muted">{total} publications</p>

      {/* From researchers you follow */}
      {feed.length > 0 ? (
        <section className="mt-6 rounded-lg border border-rt-border bg-rt-blue-light/25 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-rt-text">From researchers you follow</h2>
            <Link href="/feed" className="text-xs text-rt-blue hover:underline">See all</Link>
          </div>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {feed.map((f) => (
              <li key={f.id}>
                <Link href={`/publications/${f.slug}`} className="block rounded-lg bg-rt-white p-3 hover:bg-rt-blue-light/40">
                  <span className="line-clamp-2 text-sm font-medium text-rt-blue">{f.title}</span>
                  <span className="mt-1 block truncate text-xs text-rt-muted">
                    {f.authors.slice(0, 3).join(', ')}
                    {f.year ? ` · ${f.year}` : ''}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <form className="mt-6 flex max-w-md gap-2" action="/publications" method="get">
        <Input name="q" defaultValue={q ?? ''} placeholder="Search titles…" aria-label="Search publications" />
        <Button type="submit" variant="secondary">Search</Button>
      </form>

      {items.length === 0 ? (
        <p className="mt-10 text-rt-muted">No publications yet. Import one by DOI from your dashboard.</p>
      ) : (
        <ul className="mt-8 space-y-4">
          {items.map((p) => {
            const linkedAuthors = p.authors.filter((a) => a.researcher).slice(0, 4);
            return (
              <li key={p.id}>
                <Card className="p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="neutral">{humanizeType(p.outputType)}</Badge>
                    {p.openAccess ? <Badge variant="success">Open Access</Badge> : null}
                  </div>
                  <Link href={`/publications/${p.slug}`} className="mt-2 block text-lg font-semibold text-rt-blue hover:underline">
                    {p.title}
                  </Link>
                  <div className="mt-2 flex items-center gap-3">
                    {linkedAuthors.length > 0 ? (
                      <div className="flex -space-x-2">
                        {linkedAuthors.map((a) => (
                          <Avatar
                            key={a.id}
                            name={a.rawName}
                            src={a.researcher!.photoUrl ?? undefined}
                            size="sm"
                            className="ring-2 ring-rt-white"
                          />
                        ))}
                      </div>
                    ) : null}
                    <p className="min-w-0 text-sm text-rt-muted">
                      {p.authors.map((a) => a.rawName).slice(0, 6).join(', ')}
                      {p.authors.length > 6 ? ' et al.' : ''}
                    </p>
                  </div>
                  <p className="mt-1 text-sm text-rt-muted">
                    {p.journal?.name ? `${p.journal.name} · ` : ''}
                    {p.publishedYear ?? ''}
                  </p>
                </Card>
              </li>
            );
          })}
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
