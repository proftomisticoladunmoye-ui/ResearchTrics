import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  recommendOpportunities,
  listSavedOpportunities,
  canPostOpportunity,
} from '@researchtrics/core';
import { Card, Badge, Button } from '@researchtrics/ui';
import { getCurrentUser } from '@/lib/current-user';
import { TYPE_LABELS } from '@/lib/opportunity-labels';

export const metadata: Metadata = {
  title: 'My Opportunities',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function DashboardOpportunitiesPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!user.researcher) redirect('/dashboard');

  const [recommended, saved] = await Promise.all([
    recommendOpportunities(user.researcher.id, 10),
    listSavedOpportunities(user.researcher.id),
  ]);
  const canPost = canPostOpportunity(user.actor);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-rt-text">Opportunities for you</h1>
          <p className="mt-1 text-sm text-rt-muted">
            Matched from your research interests and affiliations — every match explains itself.
          </p>
        </div>
        {canPost ? (
          <Button asChild size="sm">
            <Link href="/dashboard/opportunities/new">Post an opportunity</Link>
          </Button>
        ) : null}
      </div>

      {/* Explained recommendations (Spec §29) */}
      <section className="mt-6">
        <h2 className="text-base font-semibold text-rt-text">Recommended</h2>
        {recommended.length === 0 ? (
          <Card className="mt-3 p-6">
            <p className="text-sm text-rt-muted">
              No matches yet. Add research interests to your profile, then open opportunities that
              fit will surface here.{' '}
              <Link href="/opportunities" className="text-rt-blue hover:underline">
                Browse all opportunities
              </Link>
              .
            </p>
          </Card>
        ) : (
          <ul className="mt-3 space-y-3">
            {recommended.map((o) => (
              <li key={o.id}>
                <Card className="p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="neutral">{TYPE_LABELS[o.type]}</Badge>
                    {o.deadline ? (
                      <Badge variant="outline">
                        Closes{' '}
                        {o.deadline.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </Badge>
                    ) : null}
                  </div>
                  <Link
                    href={`/opportunities/${o.slug}`}
                    className="mt-2 block font-medium text-rt-blue hover:underline"
                  >
                    {o.title}
                  </Link>
                  {o.organization ? (
                    <p className="text-sm text-rt-muted">{o.organization}</p>
                  ) : null}
                  <ul className="mt-2 space-y-0.5">
                    {o.reasons.map((r) => (
                      <li key={r} className="text-xs text-rt-muted">
                        • {r}
                      </li>
                    ))}
                  </ul>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Saved */}
      <section className="mt-8">
        <h2 className="text-base font-semibold text-rt-text">
          Saved <span className="text-rt-muted">({saved.length})</span>
        </h2>
        {saved.length === 0 ? (
          <p className="mt-3 text-sm text-rt-muted">
            Nothing saved yet. Use <strong>Save</strong> on an opportunity to track it here.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-rt-border">
            {saved.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-4 py-2">
                <Link href={`/opportunities/${o.slug}`} className="text-sm text-rt-blue hover:underline">
                  {o.title}
                </Link>
                <span className="shrink-0 text-xs text-rt-muted">
                  {o.deadline
                    ? o.deadline.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                    : 'No deadline'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
