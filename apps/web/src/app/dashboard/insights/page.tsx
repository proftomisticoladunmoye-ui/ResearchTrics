import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getResearcherIntelligence } from '@researchtrics/core';
import { Card, Badge, Alert } from '@researchtrics/ui';
import { getCurrentUser } from '@/lib/current-user';

export const metadata: Metadata = {
  title: 'AI Insights',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function InsightsDashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!user.researcher) redirect('/dashboard');

  const intel = await getResearcherIntelligence(user.researcher.id);
  const { summary, expertise, groundedRecordCount } = intel;
  const maxWeight = Math.max(1, ...expertise.map((e) => e.weight));

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-2xl font-semibold text-rt-text">AI Insights</h1>
      <p className="mt-1 max-w-2xl text-sm text-rt-muted">
        An AI-generated interpretation of <strong>your own records</strong> on ResearchTrics.
        Everything here is grounded in verified data you have provided — it never invents
        publications, citations, or metrics.
      </p>

      {/* Trust labelling (Spec §64) */}
      <Alert variant="info" title="How this is generated" className="mt-6">
        Generated {summary.external ? 'by an external AI provider' : 'on-platform'} (
        <span className="font-mono">{summary.generation.model}</span>) from{' '}
        {groundedRecordCount} verified record{groundedRecordCount === 1 ? '' : 's'}. This is an
        interpretation, not a verified fact — treat it as a starting point.{' '}
        {summary.external
          ? 'Only your public records are ever sent to an AI provider; private data is never transmitted.'
          : 'No data leaves the platform.'}
      </Alert>

      {/* Grounded summary */}
      <Card className="mt-6 p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-rt-text">Profile summary</h2>
          <Badge variant="neutral">AI-generated · grounded</Badge>
        </div>
        {summary.generation.text ? (
          <p className="mt-3 text-sm leading-relaxed text-rt-text">{summary.generation.text}</p>
        ) : (
          <p className="mt-3 text-sm text-rt-muted">
            Not enough records yet to summarize. Add interests, an affiliation, and a publication
            to get started.
          </p>
        )}
      </Card>

      {/* Extracted expertise */}
      <Card className="mt-6 p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-rt-text">Likely areas of expertise</h2>
          <Badge variant="neutral">AI-generated · grounded</Badge>
        </div>
        <p className="mt-1 text-xs text-rt-muted">
          Derived only from your stated interests and the titles of your recorded publications.
        </p>
        {expertise.length === 0 ? (
          <p className="mt-3 text-sm text-rt-muted">
            Add research interests or import publications to surface your areas of expertise.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {expertise.map((term) => (
              <li key={term.term} className="flex items-center gap-3">
                <span className="w-40 shrink-0 truncate text-sm capitalize text-rt-text" title={term.term}>
                  {term.term}
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-rt-border">
                  <div
                    className="h-full rounded-full bg-rt-blue"
                    style={{ width: `${(term.weight / maxWeight) * 100}%` }}
                  />
                </div>
                <span
                  className="shrink-0 text-xs text-rt-muted"
                  title={`Evidence: ${term.evidence.join(', ')}`}
                >
                  {term.evidence.length} source{term.evidence.length === 1 ? '' : 's'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* The grounding set — every claim is traceable (Spec §29) */}
      <Card className="mt-6 p-6">
        <h2 className="text-base font-semibold text-rt-text">Records this is grounded in</h2>
        <p className="mt-1 text-xs text-rt-muted">
          The AI was given only these verified records and instructed to use nothing else.
        </p>
        {summary.facts.length === 0 ? (
          <p className="mt-3 text-sm text-rt-muted">No records yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {summary.facts.map((fact) => (
              <li key={`${fact.kind}:${fact.ref}`} className="flex gap-3 text-sm">
                <Badge variant="outline" className="h-fit shrink-0 capitalize">
                  {fact.kind}
                </Badge>
                <span className="text-rt-muted">{fact.text}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
