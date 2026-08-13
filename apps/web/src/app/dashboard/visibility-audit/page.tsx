import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { researchVisibilityAudit } from '@researchtrics/core';
import { Card, MetricCard, Badge } from '@researchtrics/ui';
import { getCurrentUser } from '@/lib/current-user';

export const metadata: Metadata = {
  title: 'Research Visibility Audit',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function VisibilityAuditPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!user.researcher) redirect('/dashboard');

  const { coverage, gaps, recommendations } = await researchVisibilityAudit(user.researcher.id);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-2xl font-semibold text-rt-text">Research Visibility Audit</h1>
      <p className="mt-1 text-sm text-rt-muted">
        What your ResearchTrics footprint contains across sources, and where the gaps are — all
        from your real records (§40).
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Publications" value={coverage.publications} />
        <MetricCard label="With DOI" value={coverage.withDoi} />
        <MetricCard label="With abstract" value={coverage.withAbstract} />
        <MetricCard label="Datasets + software" value={coverage.datasets + coverage.software} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Badge variant={coverage.hasOrcid ? 'success' : 'outline'}>
          {coverage.hasOrcid ? 'ORCID connected' : 'No ORCID'}
        </Badge>
        <Badge variant="neutral">{coverage.projects} project(s)</Badge>
        <Badge variant="neutral">{coverage.affiliations} affiliation(s)</Badge>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="text-base font-semibold text-rt-text">Visibility gaps</h2>
          {gaps.length === 0 ? (
            <p className="mt-3 text-sm text-rt-success">No gaps detected — nicely done.</p>
          ) : (
            <ul className="mt-3 space-y-1 text-sm text-rt-muted">
              {gaps.map((g) => (
                <li key={g}>• {g}</li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="p-6">
          <h2 className="text-base font-semibold text-rt-text">Recommended actions</h2>
          {recommendations.length === 0 ? (
            <p className="mt-3 text-sm text-rt-muted">Nothing outstanding.</p>
          ) : (
            <ul className="mt-3 space-y-1 text-sm text-rt-text">
              {recommendations.map((r) => (
                <li key={r}>→ {r}</li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
