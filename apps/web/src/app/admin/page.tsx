import { prisma } from '@researchtrics/db';
import { MetricCard } from '@researchtrics/ui';

export const dynamic = 'force-dynamic';

export default async function AdminOverviewPage() {
  const [researchers, publications, institutions, ojsSources] = await Promise.all([
    prisma.researcher.count({ where: { deletedAt: null } }),
    prisma.publication.count({ where: { deletedAt: null } }),
    prisma.institution.count({ where: { deletedAt: null } }),
    prisma.ojsSource.count(),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-rt-text">Overview</h1>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Researchers" value={researchers} />
        <MetricCard label="Publications" value={publications} />
        <MetricCard label="Institutions" value={institutions} />
        <MetricCard label="OJS sources" value={ojsSources} emphasis="gold" />
      </div>
    </div>
  );
}
