import { type NextRequest } from 'next/server';
import { getEmailProvider, isAdmin, unauthorized } from '@researchtrics/core';
import { ok, fail } from '@/lib/api';
import { getCurrentUser } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

/**
 * Admin: send a test email to your own address to verify the email transport
 * (Resend) is configured and reachable on THIS service — direct, no queue/worker.
 */
export async function POST(_req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !isAdmin(user.actor)) throw unauthorized();
    const provider = getEmailProvider();
    await provider.send({
      to: user.email,
      subject: 'ResearchTrics email test',
      text: 'This is a test email from ResearchTrics. If you received it, email delivery is working.',
      html: '<p>This is a test email from <strong>ResearchTrics</strong>. If you received it, email delivery is working.</p>',
    });
    return ok({ sent: true, to: user.email, provider: provider.constructor.name });
  } catch (err) {
    return fail(err);
  }
}
