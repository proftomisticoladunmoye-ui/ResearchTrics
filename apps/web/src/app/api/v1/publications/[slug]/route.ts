import { type NextRequest } from 'next/server';
import { prisma } from '@researchtrics/db';
import { removePublicationForResearcher, unauthorized, notFound } from '@researchtrics/core';
import { ok, fail } from '@/lib/api';
import { getCurrentUser } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

/**
 * Remove a publication from the signed-in researcher's profile. Soft-deletes the
 * record if they are the sole author (error/duplicate); otherwise detaches only
 * their authorship, preserving the shared record for co-authors.
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user?.researcher) throw unauthorized('Sign in with a researcher profile.');
    const { slug } = await params;
    const pub = await prisma.publication.findFirst({
      where: { slug, deletedAt: null },
      select: { id: true },
    });
    if (!pub) throw notFound('Publication not found.');
    const res = await removePublicationForResearcher(user.researcher.id, pub.id);
    return ok(res);
  } catch (err) {
    return fail(err);
  }
}
