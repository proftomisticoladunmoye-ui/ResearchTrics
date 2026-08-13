import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { requestProfileRemoval, unauthorized } from '@researchtrics/core';
import { ok, fail } from '@/lib/api';
import { getCurrentUser } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

const schema = z.object({ reason: z.string().max(500).optional() });

/**
 * Request removal of an UNCLAIMED profile (Discovery Engine §35). Requires
 * sign-in and is audited; the core service suppresses it and records a minimal
 * suppression so future syncs never recreate it.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw unauthorized('Sign in to request removal');
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    const { id } = await params;
    await requestProfileRemoval(id, parsed.success ? parsed.data.reason : undefined, user.id);
    return ok({ removed: true });
  } catch (err) {
    return fail(err);
  }
}
