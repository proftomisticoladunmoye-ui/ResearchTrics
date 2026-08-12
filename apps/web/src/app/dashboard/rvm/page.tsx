import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getOrComputeRvm } from '@researchtrics/core';
import { Card, Badge, Alert, Button } from '@researchtrics/ui';
import { getCurrentUser } from '@/lib/current-user';
import { RvmRecalculate } from '@/components/rvm-recalculate';

export const metadata: Metadata = {
  title: 'Research Visibility Metric',
  robots: { index: false, follow: false },
};

function ScoreBar({ value }: { value: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-rt-border">
      <div className="h-full rounded-full bg-rt-blue" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export default async function RvmDashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!user.researcher) redirect('/dashboard');

  const { result, bundle, previousOverall } = await getOrComputeRvm(user.researcher.id);
  const delta = previousOverall === null ? null : Math.round((result.overall - previousOverall) * 10) / 10;

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-rt-text">Research Visibility Metric</h1>
          <p className="mt-1 max-w-2xl text-sm text-rt-muted">
            RVM measures research <strong>visibility</strong> — not impact, and not quality.
          </p>
        </div>
        <RvmRecalculate />
      </div>

      {/* Overall (the sanctioned gold headline metric) */}
      <div className="mt-6 grid gap-4 sm:grid-cols-[240px_1fr]">
        <Card className="flex flex-col items-center justify-center p-6">
          <p className="text-sm text-rt-muted">Overall RVM</p>
          <p className="mt-1 text-5xl font-semibold tabular-nums text-rt-gold-dark">{result.overall}</p>
          <p className="text-xs text-rt-muted">out of 100</p>
          {delta !== null ? (
            <p className={`mt-2 text-xs ${delta >= 0 ? 'text-rt-success' : 'text-rt-error'}`}>
              {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)} vs previous
            </p>
          ) : (
            <p className="mt-2 text-xs text-rt-muted">First calculation</p>
          )}
        </Card>
        <div className="space-y-3">
          <Alert variant="info" title="About this score">
            {result.disclaimer} Confidence: {Math.round(result.confidence * 100)}% (share of
            indicators with data). Version {result.version}.
          </Alert>
          <div className="flex items-center justify-between rounded-lg border border-rt-border bg-rt-white p-4">
            <div>
              <p className="text-sm font-medium text-rt-text">Profile completeness</p>
              <p className="text-xs text-rt-muted">{bundle.completeness.percent}% complete</p>
            </div>
            <div className="w-40">
              <ScoreBar value={bundle.completeness.percent} />
            </div>
          </div>
        </div>
      </div>

      {/* Improve My Visibility (Spec §30) */}
      {bundle.recommendations.length > 0 ? (
        <Card className="mt-8 p-6">
          <h2 className="text-base font-semibold text-rt-text">Improve my visibility</h2>
          <ul className="mt-3 space-y-2">
            {bundle.recommendations.slice(0, 8).map((r) => (
              <li key={r.key} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-rt-text">{r.title}</span>
                {r.action ? (
                  <Button asChild size="sm" variant="ghost">
                    <Link href={r.action.href}>{r.action.label}</Link>
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {/* Dimensions — fully transparent */}
      <h2 className="mt-8 text-base font-semibold text-rt-text">Dimensions</h2>
      <div className="mt-3 space-y-3">
        {result.dimensions.map((d) => (
          <Card key={d.key} className="p-5">
            <div className="flex items-center justify-between gap-4">
              <p className="font-medium text-rt-text">{d.name}</p>
              <div className="flex items-center gap-3">
                <span className="text-sm tabular-nums text-rt-muted">weight {Math.round(d.weight * 100)}%</span>
                <span className="w-10 text-right font-semibold tabular-nums text-rt-text">{d.score}</span>
              </div>
            </div>
            <div className="mt-2">
              <ScoreBar value={d.score} />
            </div>
            <details className="mt-3">
              <summary className="cursor-pointer text-xs text-rt-muted">Indicators</summary>
              <ul className="mt-2 space-y-1 text-xs">
                {d.indicators.map((i) => (
                  <li key={i.key} className="flex items-center justify-between gap-2">
                    <span className="text-rt-text">
                      {i.label}
                      {i.missing ? <Badge variant="outline" className="ml-2">no data</Badge> : null}
                    </span>
                    <span className="tabular-nums text-rt-muted">
                      raw {i.raw} · norm {Math.round(i.normalized * 100)}% · w {Math.round(i.weight * 100)}%
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          </Card>
        ))}
      </div>

      {result.missingData.length > 0 ? (
        <p className="mt-6 text-xs text-rt-muted">
          Missing data reduces confidence: {result.missingData.join(', ')}.
        </p>
      ) : null}
    </div>
  );
}
