import { type NextRequest } from 'next/server';
import { z } from 'zod';
import {
  verifyAffiliation,
  revokeAffiliationVerification,
  removeAffiliation,
  unauthorized,
  validationError,
} from '@researchtrics/core';
import { ok, fail } from '@/lib/api';
import { getCurrentUser } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

const schema = z.object({ verified: z.boolean() });

/**
 * Confirm or revoke an institutional affiliation. Authorization (tenant
 * isolation) and audit are enforced inside the core service — the route only
 * establishes the authenticated actor.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ affiliationId: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) throw unauthorized();
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw validationError('Expected { verified: boolean }');
    const { affiliationId } = await params;

    if (parsed.data.verified) {
      await verifyAffiliation(user.actor, affiliationId);
    } else {
      await revokeAffiliationVerification(user.actor, affiliationId);
    }
    return ok({ affiliationId, verified: parsed.data.verified });
  } catch (err) {
    return fail(err);
  }
}

/** Remove one of the current researcher's own affiliations (§7). */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ affiliationId: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user || !user.researcher) throw unauthorized();
    const { affiliationId } = await params;
    await removeAffiliation(affiliationId, user.researcher.id);
    return ok({ removed: true });
  } catch (err) {
    return fail(err);
  }
}
