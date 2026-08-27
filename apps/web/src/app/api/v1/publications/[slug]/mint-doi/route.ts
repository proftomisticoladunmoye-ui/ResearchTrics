import { type NextRequest } from 'next/server';
import { prisma } from '@researchtrics/db';
import { mintPublicationDoi, isAdmin, unauthorized, forbidden, notFound } from '@researchtrics/core';
import { ok, fail } from '@/lib/api';
import { getCurrentUser } from '@/lib/current-user';
import { enforceRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * Mint a DataCite DOI for a publication the signed-in researcher authored (or any
 * publication for an admin). Gated on DataCite credentials in core; returns a
 * clear message when unconfigured. Idempotent — a work that already has a DOI is
 * returned unchanged.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user?.researcher) throw unauthorized('Sign in with a researcher profile.');
    await enforceRateLimit('importDoi', `user:${user.researcher.id}`);

    const { slug } = await params;
    const pub = await prisma.publication.findFirst({
      where: { slug, deletedAt: null },
      select: { id: true },
    });
    if (!pub) throw notFound('Publication not found.');

    // Only a linked author (or an admin) may mint a DOI for a work.
    if (!isAdmin(user.actor)) {
      const authorship = await prisma.publicationAuthor.findFirst({
        where: { publicationId: pub.id, researcherId: user.researcher.id },
        select: { id: true },
      });
      if (!authorship) throw forbidden('Only an author of this work can mint its DOI.');
    }

    const result = await mintPublicationDoi(pub.id, { actorId: user.id });
    return ok(result);
  } catch (err) {
    return fail(err);
  }
}
