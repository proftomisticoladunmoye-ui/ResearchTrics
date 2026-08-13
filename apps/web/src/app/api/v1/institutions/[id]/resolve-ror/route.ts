import { type NextRequest } from 'next/server';
import { canManageInstitution, resolveInstitution, unauthorized } from '@researchtrics/core';
import { prisma } from '@researchtrics/db';
import { ok, fail } from '@/lib/api';
import { getCurrentUser } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

/** Find ROR candidate matches for an institution (Federation §8). Tenant-guarded. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    const { id } = await params;
    if (!user || !canManageInstitution(user.actor, id)) throw unauthorized();
    const inst = await prisma.institution.findUnique({ where: { id }, select: { name: true, country: true } });
    const candidates = inst ? await resolveInstitution(inst.name, { country: inst.country ?? undefined }) : [];
    return ok({ candidates });
  } catch (err) {
    return fail(err);
  }
}
