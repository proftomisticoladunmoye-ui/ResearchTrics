import { dataQualityReport } from '@researchtrics/core';
import { Card, MetricCard } from '@researchtrics/ui';

export const dynamic = 'force-dynamic';

function bar(score: number) {
  const color = score >= 80 ? 'bg-rt-success' : score >= 50 ? 'bg-rt-gold' : 'bg-rt-error';
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-rt-border">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(0, Math.min(100, score))}%` }} />
    </div>
  );
}

export default async function AdminQualityPage() {
  const report = await dataQualityReport();

  return (
    <div>
      <h1 className="text-2xl font-semibold text-rt-text">Metadata quality</h1>
      <p className="mt-1 text-sm text-rt-muted">
        Grounded data-quality indicators over real records (§42) — completeness, uniqueness,
        validity, and provenance coverage.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <MetricCard label="Overall quality" value={`${report.score}`} emphasis="gold" hint="0–100" />
      </div>

      <Card className="mt-6 p-6">
        <ul className="space-y-4">
          {report.metrics.map((m) => (
            <li key={m.key}>
              <div className="flex items-center justify-between text-sm">
                <span className="text-rt-text">{m.label}</span>
                <span className="tabular-nums text-rt-muted">{m.score} · {m.detail}</span>
              </div>
              <div className="mt-1">{bar(m.score)}</div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
