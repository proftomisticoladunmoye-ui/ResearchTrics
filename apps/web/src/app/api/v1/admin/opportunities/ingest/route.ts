import { type NextRequest } from 'next/server';
import { z } from 'zod';
import {
  isAdmin,
  ingestOpportunities,
  createOpportunityProvider,
  unauthorized,
  validationError,
} from '@researchtrics/core';
import { ok, fail } from '@/lib/api';
import { getCurrentUser } from '@/lib/current-user';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  source: z.enum(['fixture', 'grants_gov', 'eu_funding', 'wikicfp']),
  keyword: z.string().max(200).optional(),
  rows: z.number().int().min(1).max(200).optional(),
});

/**
 * Admin: run opportunity ingestion on demand (Spec §20). Runs inline so the
 * admin gets the created/updated counts back immediately — ingestion of a
 * bounded page is fast, and this needs no Redis on the web tier. The worker
 * still runs enabled sources on a daily schedule.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !isAdmin(user.actor)) throw unauthorized();

    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw validationError('Invalid ingestion request');

    const provider = createOpportunityProvider(parsed.data.source, {
      grantsGov: { baseUrl: process.env.GRANTS_GOV_BASE_URL },
      euFunding: { baseUrl: process.env.EU_FUNDING_BASE_URL },
      wikicfp: { category: process.env.WIKICFP_CATEGORY },
    });
    const result = await ingestOpportunities(provider, {
      keyword: parsed.data.keyword,
      rows: parsed.data.rows ?? 100,
    });
    return ok(result);
  } catch (err) {
    return fail(err);
  }
}
