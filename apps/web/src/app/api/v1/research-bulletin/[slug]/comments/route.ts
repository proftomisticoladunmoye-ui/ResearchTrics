import { type NextRequest } from 'next/server';
import { getPublishedBulletinBySlug, submitBulletinComment, bulletinCommentsEnabled, badRequest } from '@researchtrics/core';
import { ok, fail } from '@/lib/api';
import { enforceRateLimit, clientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * Public: submit a scholarly-discussion comment on a bulletin (§35). No account
 * required; held for moderation (nothing appears until an admin approves it).
 * Rate-limited per IP; body is sanitized to plain text in core.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    if (!bulletinCommentsEnabled()) throw badRequest('Comments are not enabled.');
    await enforceRateLimit('bulletin-comment', `ip:${clientIp(req)}`);

    const { slug } = await params;
    const b = await getPublishedBulletinBySlug(slug);
    if (!b) throw badRequest('Bulletin not found.');

    const body = (await req.json().catch(() => ({}))) as {
      authorName?: string; authorEmail?: string; authorAffiliation?: string; authorOrcid?: string; body?: string;
    };
    await submitBulletinComment(b.id, {
      authorName: body.authorName ?? '',
      authorEmail: body.authorEmail ?? '',
      authorAffiliation: body.authorAffiliation ?? null,
      authorOrcid: body.authorOrcid ?? null,
      body: body.body ?? '',
    });
    return ok({ status: 'pending', message: 'Thank you — your comment has been submitted for moderation.' });
  } catch (err) {
    return fail(err);
  }
}
