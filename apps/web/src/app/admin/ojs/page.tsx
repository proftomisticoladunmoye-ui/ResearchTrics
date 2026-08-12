import { prisma } from '@researchtrics/db';
import { Card, Badge } from '@researchtrics/ui';
import { AddOjsSourceForm } from '@/components/admin/add-ojs-source-form';
import { OjsSyncButton } from '@/components/admin/ojs-sync-button';

export const dynamic = 'force-dynamic';

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'error' | 'neutral'> = {
  completed: 'success',
  partial: 'warning',
  failed: 'error',
  running: 'neutral',
  pending: 'neutral',
};

export default async function AdminOjsPage() {
  const [sources, jobs] = await Promise.all([
    prisma.ojsSource.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.syncJob.findMany({
      where: { integration: 'ojs' },
      orderBy: { createdAt: 'desc' },
      take: 15,
      include: { source: { select: { name: true } } },
    }),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-rt-text">OJS Synchronization</h1>
      <p className="mt-1 text-sm text-rt-muted">
        Connect OJS installations. Version and capabilities are detected at runtime; harvesting uses
        OAI-PMH and is idempotent.
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
        <section>
          <h2 className="text-base font-semibold text-rt-text">Connected sources</h2>
          {sources.length === 0 ? (
            <p className="mt-3 text-rt-muted">No OJS sources yet. Add one on the right.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {sources.map((s) => (
                <li key={s.id}>
                  <Card className="p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-rt-text">{s.name}</p>
                        <p className="truncate text-sm text-rt-muted">{s.baseUrl}</p>
                      </div>
                      <OjsSyncButton sourceId={s.id} />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                      <Badge variant={s.oaiUrl ? 'success' : 'warning'}>
                        {s.oaiUrl ? 'OAI-PMH detected' : 'OAI not detected'}
                      </Badge>
                      <Badge variant="outline">
                        {s.versionDetected ? `OJS ${s.versionDetected}` : 'version unknown'}
                      </Badge>
                      <Badge variant="outline">
                        REST: {s.restApiAvailable ? 'available' : 'n/a'}
                      </Badge>
                      {s.lastSyncedAt ? (
                        <span className="text-rt-muted">
                          Last sync {s.lastSyncedAt.toISOString().slice(0, 16).replace('T', ' ')}
                        </span>
                      ) : (
                        <span className="text-rt-muted">Never synced</span>
                      )}
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}

          <h2 className="mt-8 text-base font-semibold text-rt-text">Recent sync jobs</h2>
          {jobs.length === 0 ? (
            <p className="mt-3 text-rt-muted">No sync runs yet.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-rt-border text-left text-rt-muted">
                    <th className="py-2 pr-4 font-medium">Source</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 pr-4 font-medium">Processed</th>
                    <th className="py-2 pr-4 font-medium">Created</th>
                    <th className="py-2 pr-4 font-medium">Failed</th>
                    <th className="py-2 pr-4 font-medium">When</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((j) => (
                    <tr key={j.id} className="border-b border-rt-border">
                      <td className="py-2 pr-4">{j.source?.name ?? '—'}</td>
                      <td className="py-2 pr-4">
                        <Badge variant={STATUS_VARIANT[j.status] ?? 'neutral'}>{j.status}</Badge>
                      </td>
                      <td className="py-2 pr-4 tabular-nums">{j.processed}</td>
                      <td className="py-2 pr-4 tabular-nums">{j.created}</td>
                      <td className="py-2 pr-4 tabular-nums">{j.failed}</td>
                      <td className="py-2 pr-4 text-rt-muted">
                        {j.createdAt.toISOString().slice(0, 16).replace('T', ' ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside>
          <Card className="p-5">
            <h2 className="text-base font-semibold text-rt-text">Add OJS source</h2>
            <div className="mt-4">
              <AddOjsSourceForm />
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
