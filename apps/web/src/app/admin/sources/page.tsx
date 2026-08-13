import { federationHealthReport } from '@researchtrics/core';
import { Card, Badge } from '@researchtrics/ui';

export const dynamic = 'force-dynamic';

const STATUS_BADGE: Record<string, 'success' | 'warning' | 'error'> = {
  healthy: 'success',
  warning: 'warning',
  down: 'error',
};

export default async function AdminSourcesPage() {
  const health = await federationHealthReport();

  return (
    <div>
      <h1 className="text-2xl font-semibold text-rt-text">Source health</h1>
      <p className="mt-1 text-sm text-rt-muted">
        Live status of each scholarly metadata provider (§34). A provider shows{' '}
        <strong>down</strong> here when it is unreachable — including this environment, which makes
        no live calls.
      </p>

      <Card className="mt-6 p-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-rt-muted">
                <th className="py-2">Provider</th>
                <th>Status</th>
                <th className="text-right">Latency</th>
                <th>Checked</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {health.map((h) => (
                <tr key={h.provider} className="border-t border-rt-border">
                  <td className="py-2 font-medium text-rt-text capitalize">{h.provider}</td>
                  <td>
                    <Badge variant={STATUS_BADGE[h.status] ?? 'warning'}>{h.status}</Badge>
                  </td>
                  <td className="text-right tabular-nums text-rt-muted">
                    {h.latencyMs != null ? `${h.latencyMs} ms` : '—'}
                  </td>
                  <td className="text-rt-muted">{new Date(h.checkedAt).toLocaleTimeString('en-GB')}</td>
                  <td className="text-rt-muted">{h.error ?? 'ok'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
