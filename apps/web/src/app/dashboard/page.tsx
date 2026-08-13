import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card, MetricCard, Badge, Button } from '@researchtrics/ui';
import { getResearcherAnalytics, administeredInstitutionIds } from '@researchtrics/core';
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

  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-rt-muted">Welcome</p>
          <h1 className="text-2xl font-semibold text-rt-text">{name}</h1>
        </div>
        <div className="flex items-center gap-3">
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
          <Button asChild size="sm" variant="ghost">
            <Link href="/dashboard/insights">AI Insights</Link>
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link href="/dashboard/opportunities">Opportunities</Link>
          </Button>
          {administersInstitution ? (
            <Button asChild size="sm" variant="ghost">
              <Link href="/dashboard/institution">Institution</Link>
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

      <Card className="mt-8 p-6">
        <h2 className="text-base font-semibold text-rt-text">Next steps</h2>
        <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-rt-muted">
          <li>
            <Link href="/dashboard/profile" className="text-rt-blue hover:underline">
              Complete your profile and connect your ORCID iD
            </Link>
            .
          </li>
          <li>Add your institutional affiliation.</li>
          <li>
            <Link href="/dashboard/publications" className="text-rt-blue hover:underline">
              Import your publications by DOI
            </Link>
            .
          </li>
          <li>
            <Link href="/dashboard/outputs" className="text-rt-blue hover:underline">
              Add a project, dataset, instrument, or software
            </Link>
            .
          </li>
        </ul>
        <p className="mt-4 text-xs text-rt-muted">
          Foundation build — profile, identity, and integration features arrive in subsequent
          phases per the roadmap.
        </p>
      </Card>
    </div>
  );
}
