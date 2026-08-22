import Link from 'next/link';
import { prisma } from '@researchtrics/db';
import { MetricCard, Card, Button } from '@researchtrics/ui';
import { DigestTriggerButton } from '@/components/digest-trigger-button';
import { EmailTestButton } from '@/components/email-test-button';

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

      <Card className="mt-8 p-6">
        <h2 className="text-base font-semibold text-rt-text">Engagement email digests</h2>
        <p className="mt-1 text-sm text-rt-muted">
          Send the weekly summary now (to verified users with recent read/recommend activity).
          Needs the worker&rsquo;s email transport configured (EMAIL_PROVIDER=resend).
        </p>
        <div className="mt-4 flex flex-wrap items-start gap-3">
          <DigestTriggerButton />
          <EmailTestButton />
        </div>
      </Card>

      <Card className="mt-6 p-6">
        <h2 className="text-base font-semibold text-rt-text">Blog</h2>
        <p className="mt-1 text-sm text-rt-muted">Author and manage blog posts shown on the public site.</p>
        <div className="mt-4">
          <Button asChild size="sm">
            <Link href="/admin/blog">Manage blog</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
