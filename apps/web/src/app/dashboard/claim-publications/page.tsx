import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@researchtrics/db';
import { Card } from '@researchtrics/ui';
import { getCurrentUser } from '@/lib/current-user';
import { PublicationClaimButtons } from '@/components/publication-claim-buttons';

export const metadata: Metadata = {
  title: 'Claim your publications',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function ClaimPublicationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!user.researcher) redirect('/dashboard');
  const researcherId = user.researcher.id;
  const familyName =
    (await prisma.researcher.findUnique({ where: { id: researcherId }, select: { familyName: true } }))
      ?.familyName ?? user.researcher.displayName.split(' ').pop() ?? user.researcher.displayName;

  // Already associated with this researcher.
  const mine = await prisma.publication.findMany({
    where: { deletedAt: null, authors: { some: { researcherId } } },
    select: { id: true, title: true, slug: true, publishedYear: true },
    orderBy: { publishedYear: 'desc' },
    take: 100,
  });

  // Candidate publications: an unmatched authorship whose name looks like this
  // researcher, not already associated.
  const candidates = await prisma.publication.findMany({
    where: {
      deletedAt: null,
      authors: { some: { researcherId: null, rawName: { contains: familyName, mode: 'insensitive' } } },
      NOT: { authors: { some: { researcherId } } },
    },
    select: { id: true, title: true, slug: true, publishedYear: true },
    orderBy: { publishedYear: 'desc' },
    take: 100,
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-2xl font-semibold text-rt-text">Your publications</h1>
      <p className="mt-1 text-sm text-rt-muted">
        Confirm which publications are yours. Disputing a publication removes it from your profile
        only — the scholarly record itself is never deleted.
      </p>

      <Card className="mt-6 p-6">
        <h2 className="text-base font-semibold text-rt-text">
          Claimed <span className="text-rt-muted">({mine.length})</span>
        </h2>
        {mine.length === 0 ? (
          <p className="mt-3 text-sm text-rt-muted">No publications associated yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-rt-border">
            {mine.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-4 py-2">
                <Link href={`/publications/${p.slug}`} className="text-sm text-rt-blue hover:underline">
                  {p.title}
                  {p.publishedYear ? <span className="text-rt-muted"> ({p.publishedYear})</span> : null}
                </Link>
                <PublicationClaimButtons researcherId={researcherId} publicationId={p.id} claimed />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="mt-6 p-6">
        <h2 className="text-base font-semibold text-rt-text">
          Candidate publications <span className="text-rt-muted">({candidates.length})</span>
        </h2>
        {candidates.length === 0 ? (
          <p className="mt-3 text-sm text-rt-muted">No candidate publications to review.</p>
        ) : (
          <ul className="mt-3 divide-y divide-rt-border">
            {candidates.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-4 py-2">
                <Link href={`/publications/${p.slug}`} className="text-sm text-rt-text hover:underline">
                  {p.title}
                  {p.publishedYear ? <span className="text-rt-muted"> ({p.publishedYear})</span> : null}
                </Link>
                <PublicationClaimButtons
                  researcherId={researcherId}
                  publicationId={p.id}
                  claimed={false}
                />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
