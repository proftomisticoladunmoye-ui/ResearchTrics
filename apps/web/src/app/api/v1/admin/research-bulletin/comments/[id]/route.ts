import { type NextRequest } from 'next/server';
import { moderateBulletinComment, deleteBulletinComment, isAdmin, unauthorized, badRequest } from '@researchtrics/core';
import { ok, fail } from '@/lib/api';
import { getCurrentUser } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

/** Admin: approve or reject a comment. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || !isAdmin(user.actor)) throw unauthorized();
    const { id } = await params;
    const b = (await req.json().catch(() => ({}))) as { decision?: string };
    if (b.decision !== 'approved' && b.decision !== 'rejected') throw badRequest('decision must be approved or rejected.');
    await moderateBulletinComment(id, b.decision);
    return ok({ id, status: b.decision });
  } catch (err) {
    return fail(err);
  }
}

/** Admin: permanently delete a comment (spam/abuse cleanup). */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || !isAdmin(user.actor)) throw unauthorized();
    const { id } = await params;
    await deleteBulletinComment(id);
    return ok({ deleted: true });
  } catch (err) {
    return fail(err);
  }
}
