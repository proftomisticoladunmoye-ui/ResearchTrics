import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, Badge } from '@researchtrics/ui';
import { listCommentsForModeration, countPendingComments, bulletinCommentsEnabled, type BulletinCommentStatus } from '@researchtrics/core';
import { requireAdmin } from '@/lib/admin';
import { CommentModerationActions } from '@/components/comment-moderation';

export const metadata: Metadata = { title: 'Comment moderation — Admin', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const TABS: BulletinCommentStatus[] = ['pending', 'approved', 'rejected'];

export default async function CommentModerationPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireAdmin();
  const { status: sp } = await searchParams;
  const status: BulletinCommentStatus = TABS.includes(sp as BulletinCommentStatus) ? (sp as BulletinCommentStatus) : 'pending';
  const [comments, pending] = await Promise.all([listCommentsForModeration(status), countPendingComments()]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-rt-text">Comment moderation</h1>
          <p className="mt-1 text-sm text-rt-muted">
            Scholarly discussion is {bulletinCommentsEnabled() ? 'enabled' : 'disabled (set BULLETIN_COMMENTS_ENABLED=true)'}.
            {pending > 0 ? ` ${pending} awaiting review.` : ''}
          </p>
        </div>
        <Link href="/admin/research-bulletin" className="text-sm text-rt-blue hover:underline">← All bulletins</Link>
      </div>

      <div className="mt-4 inline-flex rounded-lg border border-rt-border bg-rt-white p-1 text-sm">
        {TABS.map((t) => (
          <Link
            key={t}
            href={`/admin/research-bulletin/comments?status=${t}`}
            className={t === status ? 'rounded-md bg-rt-blue px-4 py-1.5 font-medium text-white' : 'rounded-md px-4 py-1.5 text-rt-muted hover:text-rt-text'}
          >
            {t}{t === 'pending' && pending > 0 ? ` (${pending})` : ''}
          </Link>
        ))}
      </div>

      {comments.length === 0 ? (
        <Card className="mt-6 p-8 text-center text-sm text-rt-muted">No {status} comments.</Card>
      ) : (
        <ul className="mt-6 space-y-4">
          {comments.map((c) => (
            <li key={c.id}>
              <Card className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm">
                    <span className="font-medium text-rt-text">{c.authorName}</span>
                    <span className="text-rt-muted"> · {c.authorEmail}</span>
                    {c.authorAffiliation ? <span className="text-rt-muted"> · {c.authorAffiliation}</span> : null}
                  </div>
                  <Badge variant={c.status === 'approved' ? 'success' : c.status === 'rejected' ? 'neutral' : 'gold'}>{c.status}</Badge>
                </div>
                <p className="mt-2 whitespace-pre-line text-sm text-rt-text">{c.body}</p>
                <p className="mt-2 text-xs text-rt-muted">
                  On{' '}
                  <Link href={`/research-bulletin/${c.bulletin.slug}`} className="text-rt-blue hover:underline">
                    No. {c.bulletin.number != null ? String(c.bulletin.number).padStart(3, '0') : '—'} · {c.bulletin.title}
                  </Link>{' '}
                  · {c.createdAt.toLocaleString('en-GB')}
                </p>
                <div className="mt-3">
                  <CommentModerationActions id={c.id} status={c.status} />
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
