import { type NextRequest } from 'next/server';
import { isAdmin, queryDiscoveredResearchers, unauthorized } from '@researchtrics/core';
import type { ProfileStatus } from '@researchtrics/db';
import { ok, fail } from '@/lib/api';
import { getCurrentUser } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

/**
 * Discovery API — list discovered researchers (Discovery Engine §51). Paginated
 * and filterable by status/source/country/confidence. Internal (admin-only).
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !isAdmin(user.actor)) throw unauthorized();

    const sp = req.nextUrl.searchParams;
    const num = (k: string) => (sp.get(k) ? Number(sp.get(k)) : undefined);
    const result = await queryDiscoveredResearchers({
      status: (sp.get('status') as ProfileStatus | null) ?? undefined,
      source: sp.get('source') ?? undefined,
      country: sp.get('country') ?? undefined,
      minConfidence: num('minConfidence'),
      take: num('take'),
      skip: num('skip'),
    });
    return ok(result);
  } catch (err) {
    return fail(err);
  }
}
