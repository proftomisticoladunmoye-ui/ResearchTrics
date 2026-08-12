import { type NextRequest } from 'next/server';
import { addGroupMember, unauthorized } from '@researchtrics/core';
import { ok, fail } from '@/lib/api';
import { getCurrentUser } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || !user.researcher) throw unauthorized();
    const { id } = await params;
    await addGroupMember(id, user.researcher.id, 'Member');
    return ok({ joined: true });
  } catch (err) {
    return fail(err);
  }
}
