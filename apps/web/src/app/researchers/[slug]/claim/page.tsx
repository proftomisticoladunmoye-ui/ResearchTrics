import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getResearcherBySlug } from '@researchtrics/core';
import { prisma } from '@researchtrics/db';
import { Card, Badge, Alert, Button } from '@researchtrics/ui';
import { getCurrentUser } from '@/lib/current-user';
import { ClaimActions } from '@/components/claim-actions';

export const metadata: Metadata = {
  title: 'Claim your research profile',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function ClaimProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ not_me?: string }>;
}) {
  const { slug } = await params;
  const { not_me } = await searchParams;
  const r = await getResearcherBySlug(slug);
  if (!r) notFound();
  // Already claimed / verified / removed — nothing to claim here.
  if (r.userId || r.profileStatus === 'claimed' || r.profileStatus === 'verified') {
    redirect(`/researchers/${r.slug}`);
  }

  const user = await getCurrentUser();
  const usersResearcher = user
    ? await prisma.researcher.findFirst({
        where: { userId: user.id, deletedAt: null },
        select: { slug: true },
      })
    : null;

  const orcid = r.identifiers.find((i) => i.scheme === 'orcid')?.value;

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <Link href={`/researchers/${r.slug}`} className="text-sm text-rt-blue hover:underline">
        ← Back to profile
      </Link>

      <div className="mt-3 flex items-center gap-2">
        <Badge variant="gold">Unclaimed profile</Badge>
      </div>
      <h1 className="mt-3 text-2xl font-semibold text-rt-text">{r.displayName}</h1>
      <p className="mt-1 text-rt-muted">
        Your scholarly research already exists. ResearchTrics helps you bring it together, verify
        it, and make it more discoverable.
      </p>

      <Card className="mt-6 p-6">
        <h2 className="text-base font-semibold text-rt-text">This profile</h2>
        <ul className="mt-3 space-y-1 text-sm text-rt-muted">
          {r.interests.length > 0 ? (
            <li>Research areas: {r.interests.map((i) => i.label).join(', ')}</li>
          ) : null}
          {orcid ? <li>ORCID on record: <span className="font-mono">{orcid}</span></li> : null}
          {r.country ? <li>Country: {r.country}</li> : null}
        </ul>
      </Card>

      {!user ? (
        <Card className="mt-6 p-6">
          <p className="text-sm text-rt-text">
            To claim this profile, create an account or sign in.
          </p>
          <div className="mt-4 flex gap-3">
            <Button asChild size="sm">
              <Link href={`/register?next=/researchers/${r.slug}/claim`}>Create account</Link>
            </Button>
            <Button asChild size="sm" variant="secondary">
              <Link href={`/login?next=/researchers/${r.slug}/claim`}>Sign in</Link>
            </Button>
          </div>
        </Card>
      ) : usersResearcher ? (
        <Alert variant="info" title="Your account already has a profile" className="mt-6">
          Your account is linked to{' '}
          <Link href={`/researchers/${usersResearcher.slug}`} className="text-rt-blue underline">
            another research profile
          </Link>
          . Merging a discovered profile into an existing account is coming soon.
        </Alert>
      ) : (
        <ClaimActions
          researcherId={r.id}
          slug={r.slug}
          hasOrcid={!!orcid}
          emphasizeRemoval={not_me === '1'}
        />
      )}
    </div>
  );
}
