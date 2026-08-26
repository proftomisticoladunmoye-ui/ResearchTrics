import { issueEmailVerification, getResearcherByUserId, unauthorized, badRequest, logger } from '@researchtrics/core';
import { ok, fail } from '@/lib/api';
import { getCurrentUser } from '@/lib/current-user';
import { enforceRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * Resend the email-verification link for the signed-in user. This is the path to
 * Level 1 verification — essential for accounts created before the email
 * provider was configured, whose original link never arrived. No-ops (returns
 * ok) if the researcher is already at Level 1+ so the button can't be abused to
 * spam an already-verified address.
 */
export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) throw unauthorized('Sign in to verify your email');
    await enforceRateLimit('resend-verification', `user:${user.id}`);

    const researcher = await getResearcherByUserId(user.id);
    if (researcher && researcher.verificationLevel >= 1) {
      return ok({ alreadyVerified: true });
    }
    if (!user.email) throw badRequest('No email address on file');

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    await issueEmailVerification(user.id, user.email, appUrl);
    return ok({ sent: true });
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'resend-verification failed');
    return fail(err);
  }
}
