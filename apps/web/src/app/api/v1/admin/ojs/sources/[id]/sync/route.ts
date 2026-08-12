import { type NextRequest } from 'next/server';
import { prisma } from '@researchtrics/db';
import { isAdmin, unauthorized, notFound } from '@researchtrics/core';
import { ok, fail } from '@/lib/api';
import { getCurrentUser } from '@/lib/current-user';
import { getQueue, OJS_SYNC_QUEUE } from '@/lib/queue';

export const dynamic = 'force-dynamic';

/**
 * Enqueue an OJS sync (Spec §12, §43). The heavy harvest runs in the worker,
 * never inline in this request.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || !isAdmin(user.actor)) throw unauthorized();

    const { id } = await params;
    const source = await prisma.ojsSource.findUnique({ where: { id } });
    if (!source) throw notFound('OJS source not found');

    const job = await getQueue(OJS_SYNC_QUEUE).add(
      'sync',
      { ojsSourceId: id },
      { attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: 100 },
    );

    return ok({ enqueued: true, jobId: job.id });
  } catch (err) {
    return fail(err);
  }
}
