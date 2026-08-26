import { type NextRequest } from 'next/server';
import { listResearchers, unauthorized } from '@researchtrics/core';
import { ok, fail } from '@/lib/api';
import { getCurrentUser } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

/**
 * Typeahead search over public researcher profiles — used by the add-publication
 * co-author picker so an uploader can link a co-author who is on the platform.
 * Returns only public, minimal fields (no private data).
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.researcher) throw unauthorized('Sign in to search researchers');

    const q = (req.nextUrl.searchParams.get('q') ?? '').trim();
    if (q.length < 2) return ok({ items: [] });

    const { items } = await listResearchers({ query: q, take: 8 });
    // Never suggest the uploader themselves as a co-author.
    const filtered = items
      .filter((r) => r.id !== user.researcher!.id)
      .map((r) => ({
        id: r.id,
        displayName: r.displayName,
        slug: r.slug,
        academicRank: r.academicRank,
        country: r.country,
        photoUrl: r.photoUrl,
      }));
    return ok({ items: filtered });
  } catch (err) {
    return fail(err);
  }
}
