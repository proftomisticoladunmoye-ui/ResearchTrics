import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, Badge, Button } from '@researchtrics/ui';
import { listAllBlogPosts } from '@researchtrics/core';
import { requireAdmin } from '@/lib/admin';

export const metadata: Metadata = { title: 'Blog — Admin', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

function fmt(d: Date): string {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default async function AdminBlogPage() {
  const user = await requireAdmin();
  const posts = await listAllBlogPosts(user.actor);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-rt-text">Blog</h1>
          <p className="mt-1 text-sm text-rt-muted">Author and manage posts. Drafts are hidden until published.</p>
        </div>
        <Button asChild size="sm">
          <Link href="/admin/blog/new">+ New post</Link>
        </Button>
      </div>

      <Card className="mt-6 p-0">
        {posts.length === 0 ? (
          <p className="p-6 text-sm text-rt-muted">No posts yet. Create your first one.</p>
        ) : (
          <ul className="divide-y divide-rt-border">
            {posts.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-4 px-5 py-4">
                <div className="min-w-0">
                  <Link href={`/admin/blog/${p.id}`} className="font-medium text-rt-blue hover:underline">
                    {p.title}
                  </Link>
                  <p className="text-xs text-rt-muted">Updated {fmt(p.updatedAt)}</p>
                </div>
                <div className="flex items-center gap-3">
                  {p.published ? <Badge variant="success">Published</Badge> : <Badge variant="neutral">Draft</Badge>}
                  {p.published ? (
                    <Link href={`/blog/${p.slug}`} className="text-xs text-rt-muted hover:text-rt-blue">
                      View
                    </Link>
                  ) : null}
                  <Link href={`/admin/blog/${p.id}`} className="text-sm text-rt-blue hover:underline">
                    Edit
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
