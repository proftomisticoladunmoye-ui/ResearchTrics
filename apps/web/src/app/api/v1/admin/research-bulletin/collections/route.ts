import { type NextRequest } from 'next/server';
import { createCollection, isAdmin, unauthorized, type BulletinCollectionKind } from '@researchtrics/core';
import { ok, fail } from '@/lib/api';
import { getCurrentUser } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

/** Admin: create a bulletin collection or series (§53, §54). */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !isAdmin(user.actor)) throw unauthorized();
    const b = (await req.json().catch(() => ({}))) as {
      title?: string; description?: string; kind?: string; published?: boolean;
    };
    const kind: BulletinCollectionKind = b.kind === 'series' ? 'series' : 'collection';
    const created = await createCollection({
      title: b.title ?? '',
      description: b.description ?? null,
      kind,
      published: b.published ?? true,
    });
    return ok(created);
  } catch (err) {
    return fail(err);
  }
}
