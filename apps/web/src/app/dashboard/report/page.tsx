import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { buildImpactReport, getPlanStatus, isAdmin } from '@researchtrics/core';
import { Badge } from '@researchtrics/ui';
import { getCurrentUser } from '@/lib/current-user';
import { PrintButton } from '@/components/print-button';

export const metadata: Metadata = { title: 'Impact report', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

function Metric({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="rounded-lg border border-rt-border p-4">
      <p className="text-2xl font-semibold text-rt-text">{typeof value === 'number' ? value.toLocaleString() : value}</p>
      <p className="text-sm text-rt-muted">{label}</p>
      {hint ? <p className="text-xs text-rt-muted">{hint}</p> : null}
    </div>
  );
}

export default async function ImpactReportPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!user.researcher) redirect('/dashboard');

  const plan = await getPlanStatus(user.researcher.id, isAdmin(user.actor));
  const deep = plan.entitlements.reports;
  const report = await buildImpactReport(user.researcher.id, { deep });

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      {/* Actions (hidden in the PDF) */}
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-rt-muted">
          A shareable snapshot of your reach — great for tenure, promotion, and grant applications.
        </p>
        <div className="flex items-center gap-2">
          {!deep ? (
            <Link href="/pricing" className="text-sm font-medium text-rt-blue hover:underline">
              Unlock full report →
            </Link>
          ) : null}
          <PrintButton />
        </div>
      </div>

      {/* The report itself */}
      <article className="rounded-xl border border-rt-border bg-rt-white p-8">
        <header className="flex items-start justify-between gap-4 border-b border-rt-border pb-4">
          <div>
            <h1 className="text-2xl font-semibold text-rt-text">{report.researcher.displayName}</h1>
            <p className="text-sm text-rt-muted">
              {report.researcher.affiliation ?? 'Researcher'}
              {report.researcher.country ? ` · ${report.researcher.country}` : ''}
            </p>
            <p className="mt-1 font-mono text-xs text-rt-muted">{report.researcher.researchtricsId}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-rt-blue">ResearchTrics</p>
            <p className="text-xs text-rt-muted">Research Impact Report</p>
            <p className="text-xs text-rt-muted">{report.generatedAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>
        </header>

        <section className="mt-6">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-rt-text">At a glance</h2>
            <Badge variant="neutral">last {Math.round(report.windowDays / 30)} months</Badge>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Metric label="Publications" value={report.metrics.publications} />
            <Metric label="Citations" value={report.metrics.citations} hint="max across sources" />
            <Metric label="Publication views" value={report.metrics.publicationViews} hint="bot-filtered" />
            <Metric label="Profile views" value={report.metrics.profileViews} hint="bot-filtered" />
            <Metric label="Downloads" value={report.metrics.downloads} />
            <Metric label="Followers" value={report.metrics.followers} />
          </div>
          {report.rvm != null ? (
            <p className="mt-3 text-sm text-rt-text">
              <strong>Research Visibility Metric (RVM):</strong> {report.rvm}/100 —{' '}
              <span className="text-rt-muted">a transparent measure of how discoverable your work is.</span>
            </p>
          ) : null}
        </section>

        <section className="mt-6">
          <h2 className="text-base font-semibold text-rt-text">Most-cited work</h2>
          {report.topPublications.length === 0 ? (
            <p className="mt-2 text-sm text-rt-muted">No publications recorded yet.</p>
          ) : (
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-rt-text">
              {report.topPublications.map((p) => (
                <li key={p.slug}>
                  {p.title}
                  <span className="text-rt-muted">
                    {p.venue ? ` — ${p.venue}` : ''}
                    {p.year ? ` (${p.year})` : ''}
                    {p.citationCount ? ` · ${p.citationCount} citations` : ''}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="mt-6">
          <h2 className="text-base font-semibold text-rt-text">Global reach</h2>
          {report.deep ? (
            report.reachByCountry && report.reachByCountry.length > 0 ? (
              <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-rt-text sm:grid-cols-3">
                {report.reachByCountry.map((c) => (
                  <li key={c.country} className="flex justify-between">
                    <span>{c.country}</span>
                    <span className="tabular-nums text-rt-muted">{c.count}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-rt-muted">No location-tagged engagement yet.</p>
            )
          ) : (
            <div className="no-print mt-2 rounded-lg border border-dashed border-rt-gold bg-rt-gold-light/20 p-4 text-sm">
              <p className="text-rt-text">See which countries your work is read from.</p>
              <Link href="/pricing" className="mt-1 inline-block font-medium text-rt-blue hover:underline">
                Upgrade to Premium to unlock global reach →
              </Link>
            </div>
          )}
        </section>

        <footer className="mt-8 border-t border-rt-border pt-4 text-xs text-rt-muted">
          Generated by ResearchTrics · {appUrl}/researchers/{report.researcher.slug} · Figures are
          bot-filtered and drawn from verified platform data.
        </footer>
      </article>
    </div>
  );
}
