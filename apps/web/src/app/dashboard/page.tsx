import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card, MetricCard, Badge, Button } from '@researchtrics/ui';
import {
  getResearcherAnalytics,
  administeredInstitutionIds,
  getOnboardingChecklist,
  type OnboardingStep,
} from '@researchtrics/core';
import { getCurrentUser } from '@/lib/current-user';

export const metadata: Metadata = {
  title: 'Dashboard',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const name = user.researcher?.displayName ?? user.email;
  const analytics = user.researcher ? await getResearcherAnalytics(user.researcher.id, 30) : null;
  const administersInstitution = administeredInstitutionIds(user.actor).length > 0;
  const onboarding: OnboardingStep[] = user.researcher
    ? await getOnboardingChecklist(user.researcher.id)
    : [];
  const remainingSteps = onboarding.filter((s) => !s.done);
  const completedCount = onboarding.length - remainingSteps.length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-rt-muted">Welcome</p>
          <h1 className="text-2xl font-semibold text-rt-text">{name}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {user.researcher ? (
            <Badge variant="gold" className="font-mono">
              {user.researcher.researchtricsId}
            </Badge>
          ) : null}
          <Button asChild size="sm">
            <Link href="/dashboard/profile">Edit profile</Link>
          </Button>
          <Button asChild size="sm" variant="accent">
            <Link href="/dashboard/rvm">View RVM</Link>
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link href="/dashboard/analytics">Analytics</Link>
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link href="/dashboard/collaborate">Collaborate</Link>
          </Button>
          <Button asChild size="sm" variant="accent">
            <Link href="/dashboard/assistant">AI Assistant</Link>
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link href="/dashboard/opportunities">Opportunities</Link>
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link href="/dashboard/files">Files</Link>
          </Button>
          {user.researcher ? (
            <Button asChild size="sm" variant="ghost">
              <Link href="/dashboard/visibility-audit">Visibility audit</Link>
            </Button>
          ) : null}
          {administersInstitution ? (
            <Button asChild size="sm" variant="ghost">
              <Link href="/dashboard/institution">Institution</Link>
            </Button>
          ) : null}
          {user.researcher ? (
            <Button asChild size="sm" variant="ghost">
              <Link href={`/researchers/${user.researcher.slug}/network`}>My network</Link>
            </Button>
          ) : null}
          {user.researcher ? (
            <Button asChild size="sm" variant="ghost">
              <Link href={`/researchers/${user.researcher.slug}`}>View public profile</Link>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Publications" value={analytics?.publicationCount ?? 0} />
        <MetricCard label="Citations" value={analytics?.citationTotal ?? 0} />
        <Link href="/dashboard/analytics" className="block">
          <MetricCard label="Publication views" value={analytics?.publicationViews ?? 0} hint="bot-filtered" />
        </Link>
        <Link href="/dashboard/rvm" className="block">
          <MetricCard label="RVM (prototype)" value="View" emphasis="gold" hint="Research Visibility Metric" />
        </Link>
      </div>

      {user.researcher ? (
        <Card className="mt-8 p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-rt-text">
              {remainingSteps.length === 0 ? 'Your profile is all set' : 'Next steps'}
            </h2>
            {onboarding.length > 0 ? (
              <span className="text-xs text-rt-muted">
                {completedCount} of {onboarding.length} complete
              </span>
            ) : null}
          </div>

          {remainingSteps.length === 0 ? (
            <p className="mt-3 text-sm text-rt-muted">
              You&rsquo;ve completed every setup step — your profile, ORCID, affiliation,
              publications, and outputs are in place. Keep your work up to date to grow your
              visibility.
            </p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {remainingSteps.map((step) => (
                <li key={step.key} className="flex items-start gap-2 text-rt-muted">
                  <span aria-hidden className="mt-0.5 text-rt-muted">○</span>
                  <Link href={step.href} className="text-rt-blue hover:underline">
                    {step.label}
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {completedCount > 0 && remainingSteps.length > 0 ? (
            <ul className="mt-4 space-y-1 border-t border-rt-border pt-4 text-sm text-rt-muted">
              {onboarding
                .filter((s) => s.done)
                .map((step) => (
                  <li key={step.key} className="flex items-start gap-2">
                    <span aria-hidden className="mt-0.5 text-rt-success">✓</span>
                    <span className="line-through decoration-rt-border">{step.label}</span>
                  </li>
                ))}
            </ul>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
