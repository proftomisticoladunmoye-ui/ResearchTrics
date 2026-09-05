import { type NextRequest } from 'next/server';
import {
  updateBulletin,
  publishBulletin,
  setBulletinStatus,
  isAdmin,
  unauthorized,
  badRequest,
  BULLETIN_TYPES,
  type BulletinType,
  type BulletinStatus,
} from '@researchtrics/core';
import { ok, fail } from '@/lib/api';
import { getCurrentUser } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

const STATUSES: BulletinStatus[] = ['draft', 'in_review', 'scheduled', 'published', 'archived'];

/** Admin: update content, or run a lifecycle action (publish / set status). */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || !isAdmin(user.actor)) throw unauthorized();
    const { id } = await params;
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown> & { action?: string };

    if (b.action === 'publish') {
      const result = await publishBulletin(id);
      return ok(result);
    }
    if (b.action === 'status') {
      const status = b.status as BulletinStatus;
      if (!STATUSES.includes(status)) throw badRequest('Invalid status.');
      await setBulletinStatus(id, status);
      return ok({ status });
    }

    const type = BULLETIN_TYPES.includes(b.type as BulletinType) ? (b.type as BulletinType) : undefined;
    await updateBulletin(id, {
      ...(typeof b.title === 'string' ? { title: b.title } : {}),
      ...(b.subtitle !== undefined ? { subtitle: b.subtitle as string | null } : {}),
      ...(type ? { type } : {}),
      ...(typeof b.category === 'string' ? { category: b.category } : {}),
      ...(typeof b.abstract === 'string' ? { abstract: b.abstract } : {}),
      ...(Array.isArray(b.keywords) ? { keywords: b.keywords as string[] } : {}),
      ...(typeof b.bodyHtml === 'string' ? { bodyHtml: b.bodyHtml } : {}),
      ...(Array.isArray(b.authors) ? { authors: b.authors as never[] } : {}),
      ...(Array.isArray(b.references) ? { references: b.references as never[] } : {}),
      ...(b.featuredImage !== undefined ? { featuredImage: b.featuredImage as string | null } : {}),
      ...(typeof b.license === 'string' ? { license: b.license } : {}),
    });
    return ok({ id });
  } catch (err) {
    return fail(err);
  }
}
