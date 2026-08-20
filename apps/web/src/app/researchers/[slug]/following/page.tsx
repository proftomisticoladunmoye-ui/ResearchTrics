import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getResearcherBySlug, listFollowing, filterFollowed } from '@researchtrics/core';
import { getCurrentUser } from '@/lib/current-user';
import { FollowList } from '@/components/follow-list';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const r = await getResearcherBySlug(slug);
  return { title: r ? `${r.displayName} is following` : 'Following', robots: { index: false } };
}

export default async function FollowingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const r = await getResearcherBySlug(slug);
  if (!r) notFound();

  const viewer = await getCurrentUser();
  const items = await listFollowing(r.id, { take: 200 });
  const followed = viewer?.researcher
    ? await filterFollowed(viewer.researcher.id, items.map((i) => i.id))
    : new Set<string>();

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <Link href={`/researchers/${r.slug}`} className="text-sm text-rt-blue hover:underline">
        ← {r.displayName}
      </Link>
      <h1 className="mt-2 text-2xl font-semibold text-rt-text">Following</h1>
      <p className="mt-1 text-sm text-rt-muted">{r.displayName} follows {items.length}</p>
      <FollowList
        items={items}
        followed={followed}
        viewerResearcherId={viewer?.researcher?.id ?? null}
        emptyMessage="Not following anyone yet."
      />
    </div>
  );
}
