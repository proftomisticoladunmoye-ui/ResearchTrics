import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getResearcherIntelligence, type ResearcherIntelligence } from '@researchtrics/core';
import { Card, Badge, Alert } from '@researchtrics/ui';
import { getCurrentUser } from '@/lib/current-user';
import { AssistantConsole } from '@/components/assistant-console';

export const metadata: Metadata = {
  title: 'AI Assistant',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AssistantPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!user.researcher) redirect('/dashboard');

  // The "profile interpreted" panel makes an AI call. It must NEVER blank the
  // page — the writing tools below work independently via the API route — so a
  // provider/env failure degrades to a soft note instead of throwing.
  let intel: ResearcherIntelligence | null = null;
  try {
    intel = await getResearcherIntelligence(user.researcher.id);
  } catch (err) {
    console.warn('AI Assistant: profile interpretation unavailable —', (err as Error).message);
  }
  const maxWeight = intel ? Math.max(1, ...intel.expertise.map((e) => e.weight)) : 1;

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-2xl font-semibold text-rt-text">AI Assistant</h1>
      <p className="mt-1 max-w-2xl text-sm text-rt-muted">
        Draft full journal articles, refine your writing, and plan research — optionally{' '}
        <strong>browsing the web</strong> for real, current sources. It works from your own material
        and never invents your data or results; verify everything before use.
      </p>

      {/* Writing tools — the console carries its own tool picker + guidance */}
      <div className="mt-6">
        <AssistantConsole />
      </div>

      {/* Grounded interpretation of the researcher's own records — tucked away in
          a collapsible panel so it doesn't crowd the writing tools. */}
      <details className="mt-8 rounded-lg border border-rt-border">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-rt-text [&::-webkit-details-marker]:hidden">
          <span className="mr-1 inline-block transition-transform">▸</span> Your profile insights
          <span className="ml-1 font-normal text-rt-muted">— AI summary &amp; expertise from your records</span>
        </summary>
        <div className="border-t border-rt-border p-4">
        {intel === null ? (
          <Alert variant="warning" title="Profile interpretation unavailable">
            The profile summary couldn&rsquo;t be generated right now (the AI provider may be
            unconfigured or temporarily unreachable). The writing tools above are unaffected.
          </Alert>
        ) : (
          <>
            <Alert variant="info" title="How this is generated" className="mt-3">
              Generated {intel.summary.external ? 'by an external AI provider' : 'on-platform'} (
              <span className="font-mono">{intel.summary.generation.model}</span>) from{' '}
              {intel.groundedRecordCount} verified record
              {intel.groundedRecordCount === 1 ? '' : 's'} you have provided. This is an
              interpretation, not a verified fact.{' '}
              {intel.summary.external
                ? 'Only your public records are ever sent to an AI provider; private data is never transmitted.'
                : 'No data leaves the platform.'}
            </Alert>

            <Card className="mt-4 p-6">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-semibold text-rt-text">Profile summary</h3>
                <Badge variant="neutral">AI-generated · grounded</Badge>
              </div>
              {intel.summary.generation.text ? (
                <p className="mt-3 text-sm leading-relaxed text-rt-text">
                  {intel.summary.generation.text}
                </p>
              ) : (
                <p className="mt-3 text-sm text-rt-muted">
                  Not enough records yet to summarize. Add interests, an affiliation, and a
                  publication to get started.
                </p>
              )}
            </Card>

            <Card className="mt-4 p-6">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-semibold text-rt-text">Likely areas of expertise</h3>
                <Badge variant="neutral">AI-generated · grounded</Badge>
              </div>
              <p className="mt-1 text-xs text-rt-muted">
                Derived only from your stated interests and the titles of your recorded publications.
              </p>
              {intel.expertise.length === 0 ? (
                <p className="mt-3 text-sm text-rt-muted">
                  Add research interests or import publications to surface your areas of expertise.
                </p>
              ) : (
                <ul className="mt-4 space-y-2">
                  {intel.expertise.map((term) => (
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
          </>
        )}
        </div>
      </details>
    </div>
  );
}
