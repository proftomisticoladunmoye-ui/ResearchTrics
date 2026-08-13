import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { canManageInstitution, linkInstitutionToRor, unauthorized, validationError } from '@researchtrics/core';
import { ok, fail } from '@/lib/api';
import { getCurrentUser } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

const schema = z.object({ rorId: z.string().min(1).max(64) });

/** Link an institution to a ROR record (Federation §8). Tenant-guarded, audited. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    const { id } = await params;
    if (!user || !canManageInstitution(user.actor, id)) throw unauthorized();
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw validationError('A ROR id is required');
    await linkInstitutionToRor(id, { rorId: parsed.data.rorId, actorId: user.id });
    return ok({ linked: true, rorId: parsed.data.rorId });
  } catch (err) {
    return fail(err);
  }
}
