import type { Metadata } from 'next';
import Link from 'next/link';
import { Card } from '@researchtrics/ui';
import { getAllPosts } from '@/lib/blog';
import { BlogCover } from '@/components/blog-cover';

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  title: 'Blog',
  description:
    'Guides and updates from ResearchTrics on research visibility, discovery, opportunities, and grounded AI for researchers.',
  alternates: { canonical: `${appUrl}/blog` },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function BlogIndexPage() {
  const posts = getAllPosts();
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-2xl font-semibold text-rt-text">Blog</h1>
      <p className="mt-1 max-w-2xl text-sm text-rt-muted">
        Guides and updates on making research visible, discoverable, and connected.
      </p>

      <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => (
          <li key={post.slug}>
            <Link href={`/blog/${post.slug}`} className="group block">
              <Card className="h-full overflow-hidden p-0">
                <BlogCover post={post} rounded="rounded-none" className="h-36 w-full" />
                <div className="p-4">
                  <p className="text-xs text-rt-muted">{formatDate(post.date)}</p>
                  <h2 className="mt-1 font-semibold text-rt-text group-hover:text-rt-blue">{post.title}</h2>
                  <p className="mt-2 line-clamp-3 text-sm text-rt-muted">{post.excerpt}</p>
                </div>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
