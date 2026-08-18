import { type NextRequest } from 'next/server';
import { isAdmin, unauthorized } from '@researchtrics/core';
import { ok, fail } from '@/lib/api';
import { getCurrentUser } from '@/lib/current-user';
import { getQueue, EMAIL_DIGEST_QUEUE } from '@/lib/queue';

export const dynamic = 'force-dynamic';

/**
 * Admin: run the engagement email digest now (§41). Enqueued to the worker,
 * which holds the email transport (Resend). Lets an admin test/trigger digests
 * without waiting for the weekly schedule.
 */
export async function POST(_req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !isAdmin(user.actor)) throw unauthorized();
    const job = await getQueue(EMAIL_DIGEST_QUEUE).add('digest', {});
    return ok({ enqueued: true, jobId: job.id });
  } catch (err) {
    return fail(err);
  }
}
