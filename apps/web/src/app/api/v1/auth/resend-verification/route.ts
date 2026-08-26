import {
  issueEmailVerification,
  getResearcherByUserId,
  getEmailProvider,
  unauthorized,
  badRequest,
  logger,
} from '@researchtrics/core';
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
 *
 * Failures here are almost always email configuration, so we translate them into
 * a clear, actionable message rather than a generic 500.
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

    // If no real transport is configured, the "email" would only be logged to the
    // server console and never delivered — say so plainly instead of pretending.
    const providerName = getEmailProvider().constructor.name;
    if (providerName === 'ConsoleEmailProvider') {
      throw badRequest(
        'Email delivery is not configured on this server yet, so the verification link cannot be sent. An administrator needs to set EMAIL_PROVIDER=resend, EMAIL_API_KEY, and a verified EMAIL_FROM on the web service.',
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    try {
      await issueEmailVerification(user.id, user.email, appUrl);
    } catch (sendErr) {
      // The token was created; the transport rejected the send. Surface the
      // provider's reason (e.g. unverified sender domain) so it's fixable.
      logger.error({ err: (sendErr as Error).message }, 'verification email send failed');
      throw badRequest(
        `We couldn't send the verification email — the email service rejected it. ${(sendErr as Error).message}`,
      );
    }
    return ok({ sent: true });
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'resend-verification failed');
    return fail(err);
  }
}
