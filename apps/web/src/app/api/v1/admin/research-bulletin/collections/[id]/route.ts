import { type NextRequest } from 'next/server';
import {
  updateCollection,
  setCollectionMembers,
  deleteCollection,
  isAdmin,
  unauthorized,
  type BulletinCollectionKind,
} from '@researchtrics/core';
import { ok, fail } from '@/lib/api';
import { getCurrentUser } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

/** Admin: update a collection's metadata and/or its ordered membership. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || !isAdmin(user.actor)) throw unauthorized();
    const { id } = await params;
    const b = (await req.json().catch(() => ({}))) as {
      title?: string; description?: string | null; kind?: string; published?: boolean; bulletinIds?: unknown;
    };

    const meta: Parameters<typeof updateCollection>[1] = {};
    if (typeof b.title === 'string') meta.title = b.title;
    if (b.description !== undefined) meta.description = b.description;
    if (b.kind === 'series' || b.kind === 'collection') meta.kind = b.kind as BulletinCollectionKind;
    if (typeof b.published === 'boolean') meta.published = b.published;
    if (Object.keys(meta).length > 0) await updateCollection(id, meta);

    if (Array.isArray(b.bulletinIds)) {
      await setCollectionMembers(id, (b.bulletinIds as unknown[]).filter((x): x is string => typeof x === 'string'));
    }
    return ok({ id });
  } catch (err) {
    return fail(err);
  }
}

/** Admin: delete a collection (its bulletins are untouched). */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || !isAdmin(user.actor)) throw unauthorized();
    const { id } = await params;
    await deleteCollection(id);
    return ok({ deleted: true });
  } catch (err) {
    return fail(err);
  }
}
