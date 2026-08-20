import { type NextRequest } from 'next/server';
import { followResearcher, unfollowResearcher, unauthorized, badRequest } from '@researchtrics/core';
import { ok, fail } from '@/lib/api';
import { getCurrentUser } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

/** Follow a researcher. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user?.researcher) throw unauthorized('Sign in as a researcher to follow.');
    const { id } = await params;
    if (id === user.researcher.id) throw badRequest('You cannot follow yourself.');
    const res = await followResearcher(user.researcher.id, id);
    return ok(res);
  } catch (err) {
    return fail(err);
  }
}

/** Unfollow a researcher. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user?.researcher) throw unauthorized('Sign in as a researcher to unfollow.');
    const { id } = await params;
    const res = await unfollowResearcher(user.researcher.id, id);
    return ok(res);
  } catch (err) {
    return fail(err);
  }
}
