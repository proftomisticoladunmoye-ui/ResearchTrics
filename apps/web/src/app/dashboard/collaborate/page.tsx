import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  recommendCollaborators,
  listIncomingRequests,
  listOutgoingRequests,
} from '@researchtrics/core';
import { Card, Badge } from '@researchtrics/ui';
import { getCurrentUser } from '@/lib/current-user';
import { ConnectButton } from '@/components/connect-button';
import { CollabRespond } from '@/components/collab-respond';
import { OutputCreateForm } from '@/components/output-create-form';

export const metadata: Metadata = {
  title: 'Collaborate',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function CollaboratePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!user.researcher) redirect('/dashboard');

  const [recommendations, incoming, outgoing] = await Promise.all([
    recommendCollaborators(user.researcher.id, 8),
    listIncomingRequests(user.researcher.id),
    listOutgoingRequests(user.researcher.id),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-2xl font-semibold text-rt-text">Collaborate</h1>
      <p className="mt-1 text-sm text-rt-muted">
        Recommendations are rule-based and always explained — never a black box.
      </p>

      {/* Recommended collaborators */}
      <section className="mt-8">
        <h2 className="text-base font-semibold text-rt-text">Recommended collaborators</h2>
        {recommendations.length === 0 ? (
          <p className="mt-3 text-sm text-rt-muted">
            No recommendations yet. Add research interests and an affiliation to improve matches.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {recommendations.map((r) => (
              <li key={r.researcherId}>
                <Card className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <Link href={`/researchers/${r.slug}`} className="font-medium text-rt-blue hover:underline">
                        {r.displayName}
                      </Link>
                      {r.academicRank ? <span className="ml-2 text-sm text-rt-muted">{r.academicRank}</span> : null}
                      <ul className="mt-1 space-y-0.5 text-sm text-rt-muted">
                        {r.reasons.map((reason, i) => (
                          <li key={i}>• {reason}</li>
                        ))}
                      </ul>
                    </div>
                    <ConnectButton toResearcherId={r.researcherId} />
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Incoming requests */}
      <section className="mt-10">
        <h2 className="text-base font-semibold text-rt-text">Collaboration requests</h2>
        {incoming.length === 0 ? (
          <p className="mt-3 text-sm text-rt-muted">No pending requests.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {incoming.map((req) => (
              <li key={req.id}>
                <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <Link href={`/researchers/${req.from.slug}`} className="font-medium text-rt-blue hover:underline">
                      {req.from.displayName}
                    </Link>
                    {req.message ? <p className="text-sm text-rt-muted">“{req.message}”</p> : null}
                  </div>
                  <CollabRespond requestId={req.id} />
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Outgoing */}
      {outgoing.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-base font-semibold text-rt-text">Sent requests</h2>
          <ul className="mt-4 space-y-2">
            {outgoing.map((req) => (
              <li key={req.id} className="flex items-center justify-between text-sm">
                <Link href={`/researchers/${req.to.slug}`} className="text-rt-blue hover:underline">
                  {req.to.displayName}
                </Link>
                <Badge
                  variant={req.status === 'accepted' ? 'success' : req.status === 'declined' ? 'error' : 'outline'}
                >
                  {req.status}
                </Badge>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Create a research group */}
      <section className="mt-10">
        <h2 className="text-base font-semibold text-rt-text">Start a research group</h2>
        <Card className="mt-4 p-6">
          <OutputCreateForm
            endpoint="/api/v1/research-groups"
            basePath="/research-groups"
            submitLabel="Create group"
            fields={[
              { name: 'name', label: 'Group name', required: true },
              { name: 'description', label: 'Description', type: 'textarea' },
              { name: 'interests', label: 'Research interests (comma-separated)' },
            ]}
          />
        </Card>
      </section>
    </div>
  );
}
