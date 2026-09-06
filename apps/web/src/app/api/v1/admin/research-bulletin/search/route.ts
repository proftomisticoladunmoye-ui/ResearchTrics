import { type NextRequest } from 'next/server';
import { prisma } from '@researchtrics/db';
import { isAdmin, unauthorized } from '@researchtrics/core';
import { ok, fail } from '@/lib/api';
import { getCurrentUser } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

/**
 * Admin bulletin search (returns internal ids) — backs the collection member
 * picker. Admin-gated so ids are never exposed publicly. Published bulletins
 * only (collections surface published members).
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !isAdmin(user.actor)) throw unauthorized();
    const q = (req.nextUrl.searchParams.get('q') ?? '').trim();
    if (q.length < 2) return ok({ items: [] });
    const rows = await prisma.researchBulletin.findMany({
      where: {
        status: 'published',
        OR: [{ title: { contains: q, mode: 'insensitive' } }, { keywords: { has: q } }],
      },
      select: { id: true, number: true, title: true, status: true },
      orderBy: { number: 'desc' },
      take: 10,
    });
    return ok({ items: rows });
  } catch (err) {
    return fail(err);
  }
}
