import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getBlogPostById } from '@researchtrics/core';
import { requireAdmin } from '@/lib/admin';
import { BlogEditor } from '@/components/blog-editor';

export const metadata: Metadata = { title: 'Edit post — Admin', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function EditBlogPostPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin();
  const { id } = await params;
  const post = await getBlogPostById(user.actor, id).catch(() => null);
  if (!post) notFound();

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <Link href="/admin/blog" className="text-sm text-rt-blue hover:underline">
        ← Blog
      </Link>
      <h1 className="mt-3 text-2xl font-semibold text-rt-text">Edit post</h1>
      <div className="mt-6">
        <BlogEditor
          post={{
            id: post.id,
            title: post.title,
            excerpt: post.excerpt,
            body: post.body,
            tone: post.tone,
            coverImage: post.coverImage,
            published: post.published,
          }}
        />
      </div>
    </div>
  );
}
