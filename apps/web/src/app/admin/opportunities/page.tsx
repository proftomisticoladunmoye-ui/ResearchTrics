import Link from 'next/link';
import { prisma } from '@researchtrics/db';
import { Card, Badge, MetricCard } from '@researchtrics/ui';
import { OpportunityIngestForm } from '@/components/opportunity-ingest-form';

export const dynamic = 'force-dynamic';

const STATUS_BADGE: Record<string, 'success' | 'neutral' | 'warning' | 'error'> = {
  open: 'success',
  draft: 'neutral',
  closed: 'warning',
  archived: 'error',
};

export default async function AdminOpportunitiesPage() {
  const [total, open, bySource, recent] = await Promise.all([
    prisma.opportunity.count({ where: { deletedAt: null } }),
    prisma.opportunity.count({ where: { deletedAt: null, status: 'open' } }),
    prisma.opportunity.groupBy({ by: ['source'], _count: { _all: true }, where: { deletedAt: null } }),
    prisma.opportunity.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, slug: true, title: true, type: true, status: true, source: true, deadline: true },
    }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-rt-text">Opportunities</h1>
        <p className="mt-1 text-sm text-rt-muted">
          Ingest open funding and calls from legitimate sources. Every listing keeps its provenance
          and links to the original; expired listings are auto-closed.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Total" value={total} />
        <MetricCard label="Open" value={open} emphasis="gold" />
        <MetricCard label="Sources" value={bySource.length} />
      </div>

      <Card className="p-6">
        <h2 className="text-base font-semibold text-rt-text">Run ingestion</h2>
        <div className="mt-4 max-w-md">
          <OpportunityIngestForm />
        </div>
        {bySource.length > 0 ? (
          <ul className="mt-4 flex flex-wrap gap-2">
            {bySource.map((s) => (
              <li key={s.source ?? 'none'}>
                <Badge variant="outline">
                  {s.source ?? 'manual'}: {s._count._all}
                </Badge>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      <Card className="p-6">
        <h2 className="text-base font-semibold text-rt-text">Recent listings</h2>
        {recent.length === 0 ? (
          <p className="mt-3 text-sm text-rt-muted">No opportunities yet. Run an ingestion above.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-rt-muted">
                  <th className="py-2">Title</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Source</th>
                  <th className="text-right">Deadline</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((o) => (
                  <tr key={o.id} className="border-t border-rt-border">
                    <td className="py-2 font-medium text-rt-text">
                      <Link href={`/opportunities/${o.slug}`} className="hover:underline">
                        {o.title}
                      </Link>
                    </td>
                    <td className="text-rt-muted">{o.type}</td>
                    <td>
                      <Badge variant={STATUS_BADGE[o.status] ?? 'neutral'}>{o.status}</Badge>
                    </td>
                    <td className="text-rt-muted">{o.source ?? 'manual'}</td>
                    <td className="text-right text-rt-muted">
                      {o.deadline ? new Date(o.deadline).toLocaleDateString('en-GB') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
