import type { Metadata } from 'next';
import Link from 'next/link';
import { listOpportunities } from '@researchtrics/core';
import type { OpportunityType } from '@researchtrics/db';
import { Card, Badge } from '@researchtrics/ui';
import { TYPE_LABELS } from '@/lib/opportunity-labels';

export const metadata: Metadata = {
  title: 'Opportunities',
  description: 'Grants, fellowships, calls, and positions for researchers.',
};

export const dynamic = 'force-dynamic';

function formatDeadline(d: Date | null): string {
  if (!d) return 'No deadline';
  return `Closes ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string }>;
}) {
  const sp = await searchParams;
  const type = sp.type as OpportunityType | undefined;
  const { items, total } = await listOpportunities({ query: sp.q, type, openOnly: true, take: 50 });

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-rt-text">Opportunities</h1>
          <p className="mt-1 text-sm text-rt-muted">
            Open grants, fellowships, calls, and positions. Every listing links to its original
            source.
          </p>
        </div>
        <span className="text-sm text-rt-muted">{total} open</span>
      </div>

      {items.length === 0 ? (
        <Card className="mt-6 p-6">
          <p className="text-sm text-rt-muted">No open opportunities right now. Check back soon.</p>
        </Card>
      ) : (
        <ul className="mt-6 grid gap-4">
          {items.map((o) => (
            <li key={o.id}>
              <Link href={`/opportunities/${o.slug}`}>
                <Card className="p-5 transition-colors hover:bg-rt-blue-light">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="neutral">{TYPE_LABELS[o.type]}</Badge>
                    {o.deadline ? (
                      <Badge variant="outline">{formatDeadline(o.deadline)}</Badge>
                    ) : null}
                    {o.country ? <Badge variant="outline">{o.country}</Badge> : null}
                  </div>
                  <h2 className="mt-2 font-medium text-rt-text">{o.title}</h2>
                  {o.organization ? (
                    <p className="text-sm text-rt-muted">{o.organization}</p>
                  ) : null}
                  {o.summary ? (
                    <p className="mt-2 line-clamp-2 text-sm text-rt-muted">{o.summary}</p>
                  ) : null}
                  {o.disciplines.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {o.disciplines.slice(0, 6).map((d) => (
                        <span key={d} className="rounded bg-rt-blue-light px-2 py-0.5 text-xs capitalize text-rt-blue-dark">
                          {d}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
