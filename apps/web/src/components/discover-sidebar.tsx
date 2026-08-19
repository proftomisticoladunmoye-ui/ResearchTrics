import Link from 'next/link';
import type { ReactNode } from 'react';
import { Card } from '@researchtrics/ui';
import { listPublishedBlogPosts } from '@researchtrics/core';
import { BlogCover } from '@/components/blog-cover';

/**
 * Extra panels for the Discover right rail (below Filters): featured opportunity
 * types with a display picture + a post CTA, and the latest blog posts.
 */

const ICON = {
  briefcase: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </>
  ),
  award: (
    <>
      <circle cx="12" cy="9" r="5" />
      <path d="M8.5 13.5 7 21l5-3 5 3-1.5-7.5" />
    </>
  ),
  grant: (
    <>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6 12h.01M18 12h.01" />
    </>
  ),
} as const;

const OPP_PROMOS: Array<{ href: string; label: string; hint: string; icon: ReactNode; gradient: string }> = [
  { href: '/opportunities?type=position', label: 'Job adverts', hint: 'Academic & research posts', icon: ICON.briefcase, gradient: 'from-rt-blue to-rt-blue-dark' },
  { href: '/opportunities?type=fellowship', label: 'Fellowships', hint: 'Funded research fellowships', icon: ICON.award, gradient: 'from-rt-gold to-rt-blue' },
  { href: '/opportunities?type=grant', label: 'Grants', hint: 'Calls open for funding', icon: ICON.grant, gradient: 'from-rt-success to-rt-blue' },
];

function Tile({ icon, gradient }: { icon: ReactNode; gradient: string }) {
  return (
    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${gradient}`} aria-hidden>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        {icon}
      </svg>
    </span>
  );
}

export async function DiscoverSidebar() {
  const posts = (await listPublishedBlogPosts()).slice(0, 2);

  return (
    <>
      {/* Opportunities */}
      <Card className="mt-6 p-4">
        <h2 className="text-sm font-semibold text-rt-text">Opportunities</h2>
        <ul className="mt-3 space-y-2">
          {OPP_PROMOS.map((o) => (
            <li key={o.href}>
              <Link href={o.href} className="flex items-center gap-3 rounded-lg p-1.5 hover:bg-rt-blue-light">
                <Tile icon={o.icon} gradient={o.gradient} />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-rt-text">{o.label}</span>
                  <span className="block truncate text-xs text-rt-muted">{o.hint}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <Link
          href="/dashboard/opportunities/new"
          className="mt-3 block rounded-lg bg-rt-blue px-3 py-2 text-center text-sm font-medium text-rt-white hover:opacity-90"
        >
          + Post an opportunity
        </Link>
      </Card>

      {/* From the blog */}
      <Card className="mt-6 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-rt-text">From the blog</h2>
          <Link href="/blog" className="text-xs text-rt-blue hover:underline">
            See all
          </Link>
        </div>
        <ul className="mt-3 space-y-3">
          {posts.map((post) => (
            <li key={post.slug}>
              <Link href={`/blog/${post.slug}`} className="flex items-start gap-3 group">
                <BlogCover title={post.title} tone={post.tone} image={post.coverImage} className="h-11 w-16 shrink-0" />
                <span className="line-clamp-2 text-sm text-rt-text group-hover:text-rt-blue">{post.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
