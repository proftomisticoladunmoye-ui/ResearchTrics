import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getInstitutionBySlug,
  getInstitutionOverview,
  listInstitutionMembers,
} from '@researchtrics/core';
import { Card, MetricCard, Badge } from '@researchtrics/ui';
import { requireInstitutionAdmin } from '@/lib/institution-admin';
import { AffiliationVerify } from '@/components/affiliation-verify';
import { RorNormalizer } from '@/components/ror-normalizer';

export const metadata: Metadata = {
  title: 'Institution Admin',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function InstitutionAdminPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const inst = await getInstitutionBySlug(slug);
  if (!inst) notFound();

  // Tenant-isolated guard — redirects anyone who cannot manage this institution.
  await requireInstitutionAdmin(inst.id);

  const [overview, members] = await Promise.all([
    getInstitutionOverview(inst.id),
    listInstitutionMembers(inst.id),
  ]);
  const pending = members.filter((m) => !m.verified);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-rt-muted">Institution admin</p>
          <h1 className="text-2xl font-semibold text-rt-text">{overview.institution.name}</h1>
        </div>
        <Link href={`/institutions/${inst.slug}`} className="text-sm text-rt-blue hover:underline">
          View public page →
        </Link>
      </div>
      <p className="mt-1 text-sm text-rt-muted">
        Every figure below is a live aggregate over your affiliated researchers&rsquo; verified
        records.
      </p>

      {/* Institution identity (ROR normalization, §8) */}
      <Card className="mt-6 p-6">
        <h2 className="text-base font-semibold text-rt-text">Institution identity (ROR)</h2>
        <p className="mt-1 text-xs text-rt-muted">
          Link this institution to its canonical Research Organization Registry record so name
          variants resolve to one identity.
        </p>
        <div className="mt-3">
          <RorNormalizer institutionId={inst.id} currentRorId={inst.rorId} />
        </div>
      </Card>

      {/* Grounded aggregates */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Researchers" value={overview.researcherCount} />
        <MetricCard label="Publications" value={overview.publicationCount} />
        <MetricCard label="Citations" value={overview.citationTotal} hint="max across sources" />
        <MetricCard
          label="Pending verification"
          value={overview.pendingAffiliationCount}
          emphasis={overview.pendingAffiliationCount > 0 ? 'gold' : undefined}
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Open access" value={overview.openAccessCount} />
        <MetricCard label="Projects" value={overview.outputs.projects} />
        <MetricCard label="Datasets" value={overview.outputs.datasets} />
        <MetricCard
          label="Instruments / software"
          value={overview.outputs.instruments + overview.outputs.software}
        />
      </div>

      {/* Aggregate RVM — transparent prototype */}
      <Card className="mt-6 p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-rt-text">Aggregate research visibility</h2>
          <Badge variant="gold">Prototype</Badge>
        </div>
        {overview.rvm.average === null ? (
          <p className="mt-2 text-sm text-rt-muted">
            No RVM snapshots yet for your affiliated researchers.
          </p>
        ) : (
          <p className="mt-2 text-sm text-rt-text">
            Average RVM <strong className="tabular-nums">{overview.rvm.average}</strong> · median{' '}
            <strong className="tabular-nums">{overview.rvm.median}</strong> across{' '}
            {overview.rvm.count} researcher{overview.rvm.count === 1 ? '' : 's'} with a score (
            {overview.rvm.coverage}% coverage).
          </p>
        )}
        <p className="mt-2 text-xs text-rt-muted">
          RVM measures visibility — not impact or quality. Proprietary framework, pending empirical
          validation.
        </p>
      </Card>

      {/* Verification queue */}
      <Card className="mt-6 p-6">
        <h2 className="text-base font-semibold text-rt-text">
          Affiliation verification queue{' '}
          <span className="text-rt-muted">({pending.length})</span>
        </h2>
        <p className="mt-1 text-xs text-rt-muted">
          Confirm that a researcher is genuinely affiliated with your institution. Verifying raises
          their identity verification to institution level; it is audited and can be revoked.
        </p>
        {pending.length === 0 ? (
          <p className="mt-3 text-sm text-rt-muted">Nothing awaiting verification.</p>
        ) : (
          <ul className="mt-3 divide-y divide-rt-border">
            {pending.map((m) => (
              <li key={m.affiliationId} className="flex items-center justify-between gap-4 py-2">
                <div className="min-w-0">
                  <Link
                    href={`/researchers/${m.slug}`}
                    className="font-medium text-rt-blue hover:underline"
                  >
                    {m.displayName}
                  </Link>
                  <p className="text-xs text-rt-muted">
                    {m.academicRank ?? m.role}
                    {m.isPrimary ? ' · primary' : ''}
                  </p>
                </div>
                <AffiliationVerify affiliationId={m.affiliationId} verified={false} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Members roster */}
      <Card className="mt-6 p-6">
        <h2 className="text-base font-semibold text-rt-text">
          Members <span className="text-rt-muted">({members.length})</span>
        </h2>
        {members.length === 0 ? (
          <p className="mt-3 text-sm text-rt-muted">No affiliated researchers yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-rt-border">
            {members.map((m) => (
              <li key={m.affiliationId} className="flex items-center justify-between gap-4 py-2">
                <div className="min-w-0">
                  <Link
                    href={`/researchers/${m.slug}`}
                    className="font-medium text-rt-text hover:underline"
                  >
                    {m.displayName}
                  </Link>
                  <p className="text-xs text-rt-muted">
                    {m.academicRank ?? m.role} · {m.publicationCount} publication
                    {m.publicationCount === 1 ? '' : 's'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {m.verified ? (
                    <Badge variant="success">Verified</Badge>
                  ) : (
                    <Badge variant="outline">Unverified</Badge>
                  )}
                  <AffiliationVerify affiliationId={m.affiliationId} verified={m.verified} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
