import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { discoverResearchOutputs, getBiomedicalFootprint } from '@researchtrics/core';
import { Card, Badge, Alert } from '@researchtrics/ui';
import { getCurrentUser } from '@/lib/current-user';

export const metadata: Metadata = {
  title: 'Discover research outputs',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function DiscoverOutputsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!user.researcher) redirect('/dashboard');

  const [{ orcid, provider, outputs }, footprint] = await Promise.all([
    discoverResearchOutputs(user.researcher.id),
    getBiomedicalFootprint(user.researcher.id),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-2xl font-semibold text-rt-text">Discover research outputs</h1>
      <p className="mt-1 text-sm text-rt-muted">
        Datasets and software registered under your identity, discovered from{' '}
        <span className="font-mono">{provider}</span>. These are <strong>candidates</strong> — we
        never claim ownership automatically; review and claim the ones that are yours.
      </p>

      {!orcid ? (
        <Alert variant="info" title="Connect your ORCID for best results" className="mt-6">
          Research-output discovery works best with a verified ORCID iD. Connect ORCID from your
          profile to improve matching.
        </Alert>
      ) : null}

      {outputs.length === 0 ? (
        <Card className="mt-6 p-6">
          <p className="text-sm text-rt-muted">
            No dataset or software candidates found{orcid ? ` for ORCID ${orcid}` : ''} yet. When
            the DataCite source is configured and you have registered research objects, they will
            appear here for review.
          </p>
        </Card>
      ) : (
        <ul className="mt-6 space-y-3">
          {outputs.map((o) => (
            <li key={o.externalIds.doi ?? o.title}>
              <Card className="p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="neutral" className="capitalize">
                    {o.resourceType}
                  </Badge>
                  {o.externalIds.doi ? (
                    <Badge variant="outline" className="font-mono">
                      {o.externalIds.doi}
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-2 font-medium text-rt-text">{o.title}</p>
                {o.publisher ? <p className="text-sm text-rt-muted">{o.publisher}</p> : null}
                <p className="mt-2 text-xs text-rt-muted">
                  Source: {o.provenance.source}
                  {o.provenance.sourceUrl ? (
                    <>
                      {' · '}
                      <a
                        href={o.provenance.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                      >
                        original record
                      </a>
                    </>
                  ) : null}
                </p>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {/* Biomedical research footprint (§27) — a footprint, never a quality score */}
      <Card className="mt-8 p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-rt-text">Biomedical research footprint</h2>
          <Badge variant={footprint.indicator === 'present' ? 'neutral' : 'outline'}>
            {footprint.indicator === 'present' ? `${footprint.count} PubMed record${footprint.count === 1 ? '' : 's'}` : 'None found'}
          </Badge>
        </div>
        <p className="mt-1 text-xs text-rt-muted">
          Publications indexed in PubMed under your name, from{' '}
          <span className="font-mono">{footprint.provider}</span>. This is a footprint indicator —
          <strong> not a quality score</strong>.
        </p>
        {footprint.works.length > 0 ? (
          <ul className="mt-3 divide-y divide-rt-border">
            {footprint.works.map((w) => (
              <li key={w.externalIds.pmid ?? w.title} className="py-2 text-sm">
                <span className="text-rt-text">{w.title}</span>
                <div className="mt-1 flex flex-wrap gap-1 text-xs text-rt-muted">
                  {w.externalIds.pmid ? <span className="font-mono">PMID {w.externalIds.pmid}</span> : null}
                  {w.externalIds.pmcid ? <span className="font-mono">· {w.externalIds.pmcid}</span> : null}
                  {(w.publicationTypes ?? []).slice(0, 2).map((t) => (
                    <span key={t}>· {t}</span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-rt-muted">
            No PubMed records found. When PubMed is configured, biomedical/health publications under
            your name will appear here.
          </p>
        )}
      </Card>
    </div>
  );
}
