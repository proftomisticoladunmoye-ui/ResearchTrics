import { type NextRequest } from 'next/server';
import { prisma } from '@researchtrics/db';
import { savePublication, unsavePublication, unauthorized, notFound } from '@researchtrics/core';
import { ok, fail } from '@/lib/api';
import { getCurrentUser } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

async function pubIdForSlug(slug: string): Promise<string> {
  const p = await prisma.publication.findFirst({ where: { slug, deletedAt: null }, select: { id: true } });
  if (!p) throw notFound('Publication not found.');
  return p.id;
}

/** Save (bookmark) a publication. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user?.researcher) throw unauthorized('Sign in as a researcher to save.');
    const { slug } = await params;
    const res = await savePublication(user.researcher.id, await pubIdForSlug(slug));
    return ok(res);
  } catch (err) {
    return fail(err);
  }
}

/** Remove a saved publication. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user?.researcher) throw unauthorized('Sign in as a researcher to unsave.');
    const { slug } = await params;
    const res = await unsavePublication(user.researcher.id, await pubIdForSlug(slug));
    return ok(res);
  } catch (err) {
    return fail(err);
  }
}
