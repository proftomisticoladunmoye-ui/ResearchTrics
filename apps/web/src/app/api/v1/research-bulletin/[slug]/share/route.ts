import { type NextRequest } from 'next/server';
import { getPublishedBulletinBySlug, incrementBulletinShare } from '@researchtrics/core';

export const dynamic = 'force-dynamic';

/**
 * Record that a bulletin's share action was used (engagement proxy, §31). Public
 * and best-effort — a soft metric, not a verified share. Called by the share
 * control via sendBeacon/fetch.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const b = await getPublishedBulletinBySlug(slug);
  if (b) void incrementBulletinShare(b.id);
  // Always 204 — never block or error the client on a vanity metric.
  return new Response(null, { status: 204 });
}
