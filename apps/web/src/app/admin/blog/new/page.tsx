import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/admin';
import { BlogEditor } from '@/components/blog-editor';

export const metadata: Metadata = { title: 'New post — Admin', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function NewBlogPostPage() {
  await requireAdmin();
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <Link href="/admin/blog" className="text-sm text-rt-blue hover:underline">
        ← Blog
      </Link>
      <h1 className="mt-3 text-2xl font-semibold text-rt-text">New post</h1>
      <div className="mt-6">
        <BlogEditor />
      </div>
    </div>
  );
}
