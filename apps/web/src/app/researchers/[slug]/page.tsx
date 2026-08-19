import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getResearcherBySlug,
  getResearcherAnalytics,
  listResearcherPublications,
  isAdmin,
} from '@researchtrics/core';
import {
  Avatar,
  Badge,
  Button,
  Card,
  MetricCard,
  VerificationBadge,
  OrcidBadge,
} from '@researchtrics/ui';
import { getCurrentUser } from '@/lib/current-user';
import { ReferButton } from '@/components/refer-button';
import { track } from '@/lib/track';
import { ConnectButton } from '@/components/connect-button';

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
    : r.aiSummary
      ? r.aiSummary.slice(0, 200)
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
  const [analytics, publications] = await Promise.all([
    getResearcherAnalytics(r.id),
    listResearcherPublications(r.id, { take: 100 }),
  ]);

  const orcid = r.orcidConnection?.orcid ?? r.identifiers.find((i) => i.scheme === 'orcid')?.value;
  const primaryAffiliation = r.affiliations.find((a) => a.isPrimary) ?? r.affiliations[0];

  const personJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: r.displayName,
    ...(r.academicRank ? { jobTitle: r.academicRank } : {}),
    ...(r.biography ? { description: r.biography } : r.aiSummary ? { description: r.aiSummary } : {}),
    ...(orcid ? { identifier: `https://orcid.org/${orcid}`, sameAs: `https://orcid.org/${orcid}` } : {}),
    ...(r.interests.length ? { knowsAbout: r.interests.map((i) => i.label) } : {}),
    ...(primaryAffiliation
      ? { affiliation: { '@type': 'Organization', name: primaryAffiliation.institution.name } }
      : {}),
    ...(r.website ? { url: r.website } : {}),
    mainEntityOfPage: `${appUrl}/researchers/${r.slug}`,
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd) }}
      />

      {/* Unclaimed profile — discovered from public scholarly metadata (§4, §68) */}
      {!r.userId && ['discovered', 'unclaimed', 'claim_pending'].includes(r.profileStatus) ? (
        <div className="mb-6 rounded-lg border border-rt-gold bg-rt-gold-light/30 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Badge variant="gold">Unclaimed profile</Badge>
              <p className="mt-2 text-sm text-rt-text">
                This scholarly profile was discovered from public research metadata and has{' '}
                <strong>not yet been claimed</strong>. Is this your research profile?
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button asChild size="sm">
                <Link href={`/researchers/${r.slug}/claim`}>Claim this profile</Link>
              </Button>
              <Link
                href={`/researchers/${r.slug}/claim?not_me=1`}
                className="text-sm text-rt-muted hover:underline"
              >
                This isn&rsquo;t me
              </Link>
              {viewer ? <ReferButton researcherId={r.id} /> : null}
            </div>
          </div>
        </div>
      ) : null}

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
            {viewer && !isOwner && viewer.researcher ? (
              <ConnectButton toResearcherId={r.id} />
            ) : null}
            <Link
              href={`/researchers/${r.slug}/network`}
              className="text-sm text-rt-blue hover:underline"
            >
              Research network →
            </Link>
          </div>
        </div>
      </div>

      {/* Owner toolbar — your tools, right on your profile. */}
      {isOwner ? (
        <div className="mt-6 flex flex-wrap gap-2 rounded-lg border border-rt-border bg-rt-blue-light/30 p-3">
          <Button asChild size="sm" variant="ghost">
            <Link href="/dashboard/profile">Edit profile</Link>
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link href="/dashboard/publications">Add publication</Link>
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link href="/dashboard/assistant">AI Assistant</Link>
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link href="/dashboard/analytics">Analytics</Link>
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link href="/dashboard/rvm">Visibility (RVM)</Link>
          </Button>
        </div>
      ) : null}

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
          ) : r.aiSummary ? (
            <section>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-rt-text">Overview</h2>
                <Badge variant="neutral">AI-generated</Badge>
              </div>
              <p className="mt-2 whitespace-pre-line text-rt-text">{r.aiSummary}</p>
              <p className="mt-1 text-xs text-rt-muted">
                An AI overview generated from this profile&rsquo;s verified records — an
                interpretation, not a verified statement.{isOwner ? ' Add a bio to replace it.' : ''}
              </p>
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

          {/* Publications — the heart of the profile (Spec §8, §11) */}
          <section className="mt-8">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-rt-text">
                Publications{publications.length ? ` (${publications.length})` : ''}
              </h2>
              {isOwner ? (
                <Link href="/dashboard/publications" className="text-sm text-rt-blue hover:underline">
                  Add / manage →
                </Link>
              ) : null}
            </div>

            {publications.length === 0 ? (
              <p className="mt-3 text-sm text-rt-muted">
                {isOwner ? (
                  <>
                    No publications yet.{' '}
                    <Link href="/dashboard/publications" className="text-rt-blue hover:underline">
                      Import by DOI or add one
                    </Link>
                    .
                  </>
                ) : (
                  'No public publications recorded yet.'
                )}
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-rt-border">
                {publications.map((p) => (
                  <li key={p.id} className="py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link
                          href={`/publications/${p.slug}`}
                          className="font-medium text-rt-blue hover:underline"
                        >
                          {p.title}
                        </Link>
                        <p className="mt-0.5 text-sm text-rt-muted">
                          {p.venue ? `${p.venue}` : p.outputType.replace(/_/g, ' ')}
                          {p.year ? ` · ${p.year}` : ''}
                          {p.doi ? (
                            <>
                              {' · '}
                              <a
                                href={`https://doi.org/${p.doi}`}
                                target="_blank"
                                rel="noopener noreferrer nofollow"
                                className="hover:underline"
                              >
                                DOI
                              </a>
                            </>
                          ) : null}
                        </p>
                      </div>
                      {p.citationCount != null && p.citationCount > 0 ? (
                        <span className="shrink-0 text-xs text-rt-muted" title="Citations (max across sources)">
                          {p.citationCount} cite{p.citationCount === 1 ? '' : 's'}
                        </span>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
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
