import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getResearcherAnalytics } from '@researchtrics/core';
import { Card, MetricCard } from '@researchtrics/ui';
import { getCurrentUser } from '@/lib/current-user';

export const metadata: Metadata = {
  title: 'Analytics',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AnalyticsDashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!user.researcher) redirect('/dashboard');

  const a = await getResearcherAnalytics(user.researcher.id, 30);
  const maxDay = Math.max(1, ...a.viewTrend.map((d) => d.views));

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-2xl font-semibold text-rt-text">Analytics</h1>
      <p className="mt-1 text-sm text-rt-muted">
        Bot-filtered engagement. Views are de-duplicated per visitor; automated traffic is excluded.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Profile views" value={a.profileViews} />
        <MetricCard label="Publication views" value={a.publicationViews} />
        <MetricCard label="Downloads" value={a.downloads} />
        <MetricCard label="Citations" value={a.citationTotal} emphasis="gold" hint="max across sources" />
      </div>

      {/* 30-day view trend */}
      <Card className="mt-8 p-6">
        <h2 className="text-base font-semibold text-rt-text">Views — last 30 days</h2>
        <div className="mt-4 flex h-24 items-end gap-1" role="img" aria-label="Daily views for the last 30 days">
          {a.viewTrend.map((d) => (
            <div
              key={d.day}
              className="flex-1 rounded-t bg-rt-blue"
              style={{ height: `${Math.max(2, (d.views / maxDay) * 100)}%` }}
              title={`${d.day}: ${d.views} views`}
            />
          ))}
        </div>
        <p className="mt-2 text-xs text-rt-muted">
          {a.viewTrend.reduce((s, d) => s + d.views, 0)} views in the last 30 days
        </p>
      </Card>

      {/* Top publications */}
      <Card className="mt-6 p-6">
        <h2 className="text-base font-semibold text-rt-text">Top publications by views</h2>
        {a.topPublications.length === 0 ? (
          <p className="mt-3 text-sm text-rt-muted">No publication views yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-rt-border">
            {a.topPublications.map((p) => (
              <li key={p.slug} className="flex items-center justify-between gap-4 py-2 text-sm">
                <Link href={`/publications/${p.slug}`} className="text-rt-blue hover:underline">
                  {p.title}
                </Link>
                <span className="tabular-nums text-rt-muted">{p.views} views</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
