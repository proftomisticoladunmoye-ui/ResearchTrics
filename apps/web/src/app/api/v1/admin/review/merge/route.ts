import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { isAdmin, mergeResearchers, unauthorized, validationError } from '@researchtrics/core';
import { ok, fail } from '@/lib/api';
import { getCurrentUser } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

const schema = z.object({ canonicalId: z.string().min(1), duplicateId: z.string().min(1) });

/** Merge a duplicate profile into a canonical one (Discovery Engine §24, §57). Admin only. */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !isAdmin(user.actor)) throw unauthorized();
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw validationError('canonicalId and duplicateId are required');
    await mergeResearchers(parsed.data.canonicalId, parsed.data.duplicateId, user.id);
    return ok({ merged: true, canonicalId: parsed.data.canonicalId });
  } catch (err) {
    return fail(err);
  }
}
