import { type NextRequest } from 'next/server';
import { createReferral, unauthorized } from '@researchtrics/core';
import { ok, fail } from '@/lib/api';
import { enforceRateLimit } from '@/lib/rate-limit';
import { getCurrentUser } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

/**
 * Create a colleague referral for an unclaimed profile (Discovery Engine §19).
 * Any signed-in user may refer a colleague; the raw token is returned once so
 * the referrer can share the claim link. No unsolicited bulk email (§17).
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw unauthorized('Sign in to invite a colleague');
    const { id } = await params;
    // Throttle invitations per user to prevent referral-spam (Discovery §32).
    await enforceRateLimit('invite', `user:${user.id}`);
    const invite = await createReferral(user.id, id);
    return ok({ claimUrl: `${appUrl}/claim/${invite.token}`, expiresAt: invite.expiresAt });
  } catch (err) {
    return fail(err);
  }
}
