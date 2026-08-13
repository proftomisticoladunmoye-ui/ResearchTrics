import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { discoverResearchOutputs } from '@researchtrics/core';
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

  const { orcid, provider, outputs } = await discoverResearchOutputs(user.researcher.id);

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
    </div>
  );
}
