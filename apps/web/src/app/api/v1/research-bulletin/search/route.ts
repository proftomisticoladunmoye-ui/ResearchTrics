import { type NextRequest } from 'next/server';
import { listPublishedBulletins } from '@researchtrics/core';
import { ok, fail } from '@/lib/api';

export const dynamic = 'force-dynamic';

/**
 * Public typeahead over published bulletins — powers the editor's internal
 * citation picker (§15) and general discovery. Published content only.
 */
export async function GET(req: NextRequest) {
  try {
    const q = (req.nextUrl.searchParams.get('q') ?? '').trim();
    if (q.length < 2) return ok({ items: [] });
    const { items } = await listPublishedBulletins({ query: q, take: 10 });
    return ok({
      items: items.map((b) => ({
        number: b.number,
        slug: b.slug,
        title: b.title,
        year: b.publicationDate ? b.publicationDate.getUTCFullYear() : null,
        authors: b.authors.map((a) => a.name),
      })),
    });
  } catch (err) {
    return fail(err);
  }
}
