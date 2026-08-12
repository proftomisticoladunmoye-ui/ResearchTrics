import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getResearcherBySlug, getResearcherAnalytics, isAdmin } from '@researchtrics/core';
import {
  Avatar,
  Badge,
  Card,
  MetricCard,
  VerificationBadge,
  OrcidBadge,
} from '@researchtrics/ui';
import { getCurrentUser } from '@/lib/current-user';
import { track } from '@/lib/track';

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const r = await getResearcherBySlug(slug);
  if (!r || r.profileVisibility !== 'public') {
    return { title: 'Researcher', robots: { index: false } };
  }
  const description = r.biography
    ? r.biography.slice(0, 200)
    : `${r.displayName} on ResearchTrics — ${r.researchtricsId}.`;
  return {
    title: r.displayName,
    description,
    alternates: { canonical: `${appUrl}/researchers/${r.slug}` },
    openGraph: {
      type: 'profile',
      title: r.displayName,
      description,
      url: `${appUrl}/researchers/${r.slug}`,
    },
  };
}

export default async function ResearcherProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const r = await getResearcherBySlug(slug);
  if (!r) notFound();

  // Visibility enforcement (Spec §36): non-public profiles are only visible to
  // the owner or an admin.
  const viewer = await getCurrentUser();
  const isOwner = viewer?.researcher?.id === r.id;
  const canView = r.profileVisibility === 'public' || isOwner || (viewer && isAdmin(viewer.actor));
  if (!canView) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="text-xl font-semibold text-rt-text">This profile is private</h1>
        <p className="mt-2 text-rt-muted">The researcher has restricted visibility of this profile.</p>
      </div>
    );
  }

  // Record a profile view (not for the owner viewing their own page; bots filtered).
  if (!isOwner) await track('profile_view', 'researcher', r.id);
  const analytics = await getResearcherAnalytics(r.id);

  const orcid = r.orcidConnection?.orcid ?? r.identifiers.find((i) => i.scheme === 'orcid')?.value;
  const primaryAffiliation = r.affiliations.find((a) => a.isPrimary) ?? r.affiliations[0];

  const personJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: r.displayName,
    ...(r.biography ? { description: r.biography } : {}),
    ...(orcid ? { identifier: `https://orcid.org/${orcid}`, sameAs: `https://orcid.org/${orcid}` } : {}),
    ...(primaryAffiliation
      ? { affiliation: { '@type': 'Organization', name: primaryAffiliation.institution.name } }
      : {}),
    url: `${appUrl}/researchers/${r.slug}`,
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd) }}
      />

      {/* Header */}
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <Avatar name={r.displayName} src={r.photoUrl ?? undefined} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold text-rt-text">{r.displayName}</h1>
            <VerificationBadge level={r.verificationLevel} />
          </div>
          <p className="mt-1 text-rt-muted">
            {r.academicRank ? `${r.academicRank}` : 'Researcher'}
            {primaryAffiliation ? ` · ${primaryAffiliation.institution.name}` : ''}
            {r.country ? ` · ${r.country}` : ''}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="gold" className="font-mono">
              {r.researchtricsId}
            </Badge>
            {orcid ? <OrcidBadge orcid={orcid} /> : null}
            {r.website ? (
              <a
                href={r.website}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="text-sm text-rt-blue hover:underline"
              >
                Website
              </a>
            ) : null}
          </div>
        </div>
      </div>

      {/* Research snapshot (Spec §8) — counts arrive with later phases. */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Publications" value={analytics.publicationCount} />
        <MetricCard label="Citations" value={analytics.citationTotal} hint="max across sources" />
        <MetricCard label="Profile views" value={analytics.profileViews} hint="bot-filtered" />
        <MetricCard label="Verification" value={`L${r.verificationLevel}`} emphasis="gold" />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {r.biography ? (
            <section>
              <h2 className="text-lg font-semibold text-rt-text">About</h2>
              <p className="mt-2 whitespace-pre-line text-rt-text">{r.biography}</p>
            </section>
          ) : null}

          {r.interests.length > 0 ? (
            <section className="mt-8">
              <h2 className="text-lg font-semibold text-rt-text">Research interests</h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {r.interests.map((i) => (
                  <li key={i.id}>
                    <Badge variant="neutral">{i.label}</Badge>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <aside className="space-y-6">
          {r.affiliations.length > 0 ? (
            <Card className="p-5">
              <h2 className="text-base font-semibold text-rt-text">Affiliations</h2>
              <ul className="mt-3 space-y-3">
                {r.affiliations.map((a) => (
                  <li key={a.id} className="text-sm">
                    <Link href={`/institutions/${a.institution.slug}`} className="font-medium text-rt-blue hover:underline">
                      {a.institution.name}
                    </Link>
                    <p className="text-rt-muted">
                      {a.department?.name ? `${a.department.name} · ` : ''}
                      {a.role}
                      {a.isPrimary ? ' · Primary' : ''}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <Card className="p-5">
            <h2 className="text-base font-semibold text-rt-text">External identifiers</h2>
            {r.identifiers.length > 0 ? (
              <ul className="mt-3 space-y-1 text-sm">
                {r.identifiers.map((i) => (
                  <li key={i.id} className="font-mono text-rt-muted">
                    {i.scheme.toUpperCase()}: {i.value}
                    {i.verified ? ' ✓' : ''}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-rt-muted">None connected yet.</p>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}
