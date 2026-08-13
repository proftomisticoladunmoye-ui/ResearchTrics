import { type NextRequest } from 'next/server';
import { z } from 'zod';
import {
  isAdmin,
  runDiscovery,
  createDiscoveryProvider,
  unauthorized,
  validationError,
} from '@researchtrics/core';
import { ok, fail } from '@/lib/api';
import { getCurrentUser } from '@/lib/current-user';
import { getQueue, DISCOVERY_RUN_QUEUE } from '@/lib/queue';

export const dynamic = 'force-dynamic';

const schema = z.object({
  provider: z.enum(['fixture', 'openalex', 'crossref']),
  institution: z.string().max(300).optional(),
  country: z.string().max(120).optional(),
  topic: z.string().max(200).optional(),
  rorId: z.string().max(120).optional(),
  orcid: z.string().max(40).optional(),
  limit: z.number().int().min(1).max(200).optional(),
});

/**
 * Start a researcher-discovery run (Discovery Engine §22, §23, §52). The offline
 * `fixture` provider runs inline for the controlled prototype (§67); live
 * providers are enqueued to the worker so a large campaign never blocks a
 * request.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !isAdmin(user.actor)) throw unauthorized();
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw validationError('Invalid discovery query', parsed.error.flatten());

    const { provider, ...query } = parsed.data;

    if (provider === 'fixture') {
      const summary = await runDiscovery({
        provider: createDiscoveryProvider('fixture'),
        query,
        actorId: user.id,
      });
      return ok({ mode: 'inline', ...summary });
    }

    const job = await getQueue(DISCOVERY_RUN_QUEUE).add(
      'run',
      { provider, query, actorId: user.id },
      { attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: 100 },
    );
    return ok({ mode: 'enqueued', jobId: job.id });
  } catch (err) {
    return fail(err);
  }
}
