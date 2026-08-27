import { type NextRequest } from 'next/server';
import { prisma } from '@researchtrics/db';
import { unauthorized, notFound } from '@researchtrics/core';
import { pushPublicationToOrcid } from '@researchtrics/integration-orcid';
import { ok, fail } from '@/lib/api';
import { getCurrentUser } from '@/lib/current-user';
import { enforceRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * Add one of the signed-in researcher's works to their ORCID record. Gated on
 * ORCID work sync being enabled and the connection carrying the update scope
 * (both enforced in the service); idempotent per (researcher, publication).
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

    const result = await pushPublicationToOrcid(user.researcher.id, pub.id);
    return ok(result);
  } catch (err) {
    return fail(err);
  }
}
