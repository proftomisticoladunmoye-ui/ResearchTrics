import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, Badge, Button } from '@researchtrics/ui';
import { listAllBulletins, countPendingComments, BULLETIN_TYPE_LABELS } from '@researchtrics/core';
import { requireAdmin } from '@/lib/admin';

export const metadata: Metadata = { title: 'Research Bulletin — Admin', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

function fmt(d: Date): string {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const STATUS_VARIANT: Record<string, 'success' | 'neutral' | 'gold' | 'outline'> = {
  published: 'success',
  draft: 'neutral',
  in_review: 'gold',
  scheduled: 'outline',
  archived: 'outline',
};

export default async function AdminBulletinsPage() {
  await requireAdmin();
  const [bulletins, pendingComments] = await Promise.all([listAllBulletins(), countPendingComments()]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-rt-text">Research Bulletin</h1>
          <p className="mt-1 text-sm text-rt-muted">
            The ResearchTrics scholarly publication series. Drafts are hidden until published; a permanent number is
            assigned at first publish.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/admin/research-bulletin/collections" className="text-sm text-rt-blue hover:underline">Collections</Link>
          <Link href="/admin/research-bulletin/comments" className="text-sm text-rt-blue hover:underline">
            Comments{pendingComments > 0 ? ` (${pendingComments})` : ''}
          </Link>
          <Link href="/admin/research-bulletin/analytics" className="text-sm text-rt-blue hover:underline">Analytics</Link>
          <Button asChild size="sm">
            <Link href="/admin/research-bulletin/new">+ New bulletin</Link>
          </Button>
        </div>
      </div>

      <Card className="mt-6 p-0">
        {bulletins.length === 0 ? (
          <p className="p-6 text-sm text-rt-muted">No bulletins yet. Create your first one.</p>
        ) : (
          <ul className="divide-y divide-rt-border">
            {bulletins.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-4 px-5 py-4">
                <div className="min-w-0">
                  <Link href={`/admin/research-bulletin/${b.id}`} className="font-medium text-rt-blue hover:underline">
                    {b.number != null ? `No. ${String(b.number).padStart(3, '0')} · ` : ''}{b.title}
                  </Link>
                  <p className="text-xs text-rt-muted">{BULLETIN_TYPE_LABELS[b.type]} · Updated {fmt(b.updatedAt)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={STATUS_VARIANT[b.status] ?? 'neutral'}>{b.status.replace('_', ' ')}</Badge>
                  {b.status === 'published' ? (
                    <Link href={`/research-bulletin/${b.slug}`} className="text-xs text-rt-muted hover:text-rt-blue">View</Link>
                  ) : null}
                  <Link href={`/admin/research-bulletin/${b.id}`} className="text-sm text-rt-blue hover:underline">Edit</Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
