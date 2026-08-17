import type { Metadata } from 'next';
import Link from 'next/link';
import { listOpportunities, listOpenOpportunityTypes } from '@researchtrics/core';
import type { OpportunityType } from '@researchtrics/db';
import { Card, Badge } from '@researchtrics/ui';
import { TYPE_LABELS } from '@/lib/opportunity-labels';

/** Filter chips shown above the list — jobs surfaced explicitly. */
const FILTERS: Array<{ type?: OpportunityType; label: string }> = [
  { label: 'All' },
  { type: 'grant', label: 'Grants' },
  { type: 'fellowship', label: 'Fellowships' },
  { type: 'position', label: 'Jobs' },
  { type: 'call_for_papers', label: 'Calls for papers' },
  { type: 'conference', label: 'Conferences' },
  { type: 'award', label: 'Awards' },
  { type: 'training', label: 'Training' },
];

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
  const [{ items, total }, openTypes] = await Promise.all([
    listOpportunities({ query: sp.q, type, openOnly: true, take: 50 }),
    listOpenOpportunityTypes(),
  ]);
  const openTypeSet = new Set<OpportunityType>(openTypes);
  // Only show filters for types that actually have open listings (+ the current one).
  const visibleFilters = FILTERS.filter((f) => !f.type || openTypeSet.has(f.type) || f.type === type);

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

      {/* Type filter chips — only types that currently have open listings */}
      <div className="mt-5 flex flex-wrap gap-2">
        {visibleFilters.map((f) => {
          const active = (f.type ?? undefined) === type;
          const params = new URLSearchParams();
          if (f.type) params.set('type', f.type);
          if (sp.q) params.set('q', sp.q);
          const href = params.toString() ? `/opportunities?${params.toString()}` : '/opportunities';
          return (
            <Link
              key={f.label}
              href={href}
              className={
                active
                  ? 'rounded-full bg-rt-blue px-3 py-1 text-sm font-medium text-rt-white'
                  : 'rounded-full border border-rt-border px-3 py-1 text-sm text-rt-muted hover:border-rt-blue hover:text-rt-blue'
              }
            >
              {f.label}
            </Link>
          );
        })}
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
