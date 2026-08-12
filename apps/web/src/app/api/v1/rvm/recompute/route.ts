import { type NextRequest } from 'next/server';
import { computeAndStoreRvm, unauthorized } from '@researchtrics/core';
import { ok, fail } from '@/lib/api';
import { getCurrentUser } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

/** Recompute + snapshot the caller's RVM (Spec §25). Per-researcher aggregation is light. */
export async function POST(_req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !user.researcher) throw unauthorized();
    const { result } = await computeAndStoreRvm(user.researcher.id);
    return ok({ overall: result.overall, calculatedAt: result.calculatedAt });
  } catch (err) {
    return fail(err);
  }
}
