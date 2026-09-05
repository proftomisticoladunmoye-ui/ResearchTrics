import { type NextRequest } from 'next/server';
import { createBulletin, isAdmin, unauthorized, badRequest, BULLETIN_TYPES, type BulletinType } from '@researchtrics/core';
import { ok, fail } from '@/lib/api';
import { getCurrentUser } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

interface Body {
  title?: string;
  subtitle?: string;
  type?: string;
  category?: string;
  abstract?: string;
  keywords?: unknown;
  bodyHtml?: string;
  authors?: unknown;
  references?: unknown;
  featuredImage?: string | null;
  license?: string;
}

/** Admin: create a draft Research Bulletin (§24, §44). */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !isAdmin(user.actor)) throw unauthorized();
    const b = (await req.json().catch(() => ({}))) as Body;
    if (!b.title || !b.abstract || !b.category) throw badRequest('Title, abstract and category are required.');
    const type = BULLETIN_TYPES.includes(b.type as BulletinType) ? (b.type as BulletinType) : undefined;

    const created = await createBulletin(
      {
        title: b.title,
        subtitle: b.subtitle ?? null,
        type,
        category: b.category,
        abstract: b.abstract,
        keywords: Array.isArray(b.keywords) ? (b.keywords as string[]) : [],
        bodyHtml: b.bodyHtml ?? '',
        authors: Array.isArray(b.authors) ? (b.authors as never[]) : [],
        references: Array.isArray(b.references) ? (b.references as never[]) : [],
        featuredImage: b.featuredImage ?? null,
        license: b.license,
      },
      user.id,
    );
    return ok(created);
  } catch (err) {
    return fail(err);
  }
}
