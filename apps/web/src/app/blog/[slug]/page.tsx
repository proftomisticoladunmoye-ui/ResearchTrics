import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPublishedBlogPost } from '@researchtrics/core';
import { BlogCover } from '@/components/blog-cover';

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedBlogPost(slug);
  if (!post) return { title: 'Blog', robots: { index: false } };
  return {
    title: post.title,
    description: post.excerpt,
    alternates: { canonical: `${appUrl}/blog/${post.slug}` },
    openGraph: {
      type: 'article',
      title: post.title,
      description: post.excerpt,
      url: `${appUrl}/blog/${post.slug}`,
      ...(post.publishedAt ? { publishedTime: post.publishedAt.toISOString() } : {}),
    },
  };
}

function formatDate(d: Date | null): string {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPublishedBlogPost(slug);
  if (!post) notFound();

  const paragraphs = post.body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt,
    ...(post.publishedAt ? { datePublished: post.publishedAt.toISOString() } : {}),
    author: { '@type': 'Organization', name: post.authorName ?? 'ResearchTrics' },
    publisher: { '@type': 'Organization', name: 'ResearchTrics' },
    mainEntityOfPage: `${appUrl}/blog/${post.slug}`,
  };

  return (
    <article className="mx-auto max-w-2xl px-4 py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <Link href="/blog" className="text-sm text-rt-blue hover:underline">
        ← All posts
      </Link>

      <BlogCover title={post.title} tone={post.tone} image={post.coverImage} className="mt-4 h-52 w-full" />

      <h1 className="mt-6 text-3xl font-semibold text-rt-text">{post.title}</h1>
      <p className="mt-2 text-sm text-rt-muted">
        {formatDate(post.publishedAt)}
        {post.authorName ? ` · ${post.authorName}` : ''}
      </p>

      <div className="mt-6 space-y-4">
        {paragraphs.map((para, i) => (
          <p key={i} className="text-base leading-relaxed text-rt-text">
            {para}
          </p>
        ))}
      </div>

      <div className="mt-10 rounded-lg border border-rt-border bg-rt-blue-light/30 p-5">
        <p className="text-sm text-rt-text">Ready to make your own research visible?</p>
        <Link href="/register" className="mt-2 inline-block text-sm font-medium text-rt-blue hover:underline">
          Create your profile →
        </Link>
      </div>
    </article>
  );
}
