import Link from 'next/link';
import { prisma } from '@researchtrics/db';
import { listDiscoveryRuns } from '@researchtrics/core';
import { Card, Badge } from '@researchtrics/ui';
import { DiscoveryRunForm } from '@/components/discovery-run-form';

export const dynamic = 'force-dynamic';

const RUN_BADGE: Record<string, 'success' | 'warning' | 'error' | 'neutral'> = {
  completed: 'success',
  running: 'warning',
  queued: 'neutral',
  failed: 'error',
};

export default async function AdminDiscoveryPage() {
  const [runs, discovered] = await Promise.all([
    listDiscoveryRuns(15),
    prisma.researcher.findMany({
      where: { deletedAt: null, profileStatus: 'unclaimed' },
      include: { identifiers: true },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-rt-text">Researcher Discovery</h1>
        <p className="mt-1 text-sm text-rt-muted">
          Discover researchers from legitimate scholarly metadata. Discovered profiles are{' '}
          <strong>unclaimed</strong> and provenance-backed — never presented as verified.
        </p>
      </div>

      <Card className="p-6">
        <h2 className="text-base font-semibold text-rt-text">Discover</h2>
        <div className="mt-4">
          <DiscoveryRunForm />
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-base font-semibold text-rt-text">Recent runs</h2>
        {runs.length === 0 ? (
          <p className="mt-3 text-sm text-rt-muted">No discovery runs yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-rt-muted">
                  <th className="py-2">Source</th>
                  <th>Status</th>
                  <th className="text-right">Discovered</th>
                  <th className="text-right">Created</th>
                  <th className="text-right">Matched</th>
                  <th>Started</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id} className="border-t border-rt-border">
                    <td className="py-2 font-medium text-rt-text">{r.provider}</td>
                    <td>
                      <Badge variant={RUN_BADGE[r.status] ?? 'neutral'}>{r.status}</Badge>
                    </td>
                    <td className="text-right tabular-nums">{r.discovered}</td>
                    <td className="text-right tabular-nums">{r.created}</td>
                    <td className="text-right tabular-nums">{r.matched}</td>
                    <td className="text-rt-muted">{r.startedAt.toLocaleString('en-GB')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="text-base font-semibold text-rt-text">
          Unclaimed profiles <span className="text-rt-muted">({discovered.length})</span>
        </h2>
        {discovered.length === 0 ? (
          <p className="mt-3 text-sm text-rt-muted">No unclaimed profiles yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-rt-muted">
                  <th className="py-2">Name</th>
                  <th>Country</th>
                  <th>ORCID</th>
                  <th>OpenAlex</th>
                  <th className="text-right">Confidence</th>
                  <th>Status</th>
                  <th>Profile</th>
                </tr>
              </thead>
              <tbody>
                {discovered.map((d) => {
                  const orcid = d.identifiers.find((i) => i.scheme === 'orcid')?.value;
                  const openalex = d.identifiers.find((i) => i.scheme === 'openalex')?.value;
                  return (
                    <tr key={d.id} className="border-t border-rt-border">
                      <td className="py-2 font-medium text-rt-text">{d.displayName}</td>
                      <td className="text-rt-muted">{d.country ?? '—'}</td>
                      <td className="font-mono text-xs text-rt-muted">{orcid ?? '—'}</td>
                      <td className="font-mono text-xs text-rt-muted">{openalex ?? '—'}</td>
                      <td className="text-right tabular-nums">{d.identityConfidence ?? '—'}</td>
                      <td>
                        <Badge variant="outline">{d.profileStatus}</Badge>
                      </td>
                      <td>
                        <Link href={`/researchers/${d.slug}`} className="text-rt-blue hover:underline">
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
