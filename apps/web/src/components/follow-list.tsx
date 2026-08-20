import Link from 'next/link';
import { Avatar, Card } from '@researchtrics/ui';
import type { FollowListItem } from '@researchtrics/core';
import { FollowButton } from '@/components/follow-button';

/**
 * A list of researchers (followers or following) with avatars and a follow
 * button per row, given the set the viewer already follows.
 */
export function FollowList({
  items,
  followed,
  viewerResearcherId,
  emptyMessage,
}: {
  items: FollowListItem[];
  followed: Set<string>;
  viewerResearcherId: string | null;
  emptyMessage: string;
}) {
  if (items.length === 0) {
    return <p className="mt-6 text-sm text-rt-muted">{emptyMessage}</p>;
  }
  return (
    <ul className="mt-6 space-y-3">
      {items.map((r) => (
        <li key={r.id}>
          <Card className="flex items-center justify-between gap-4 p-4">
            <Link href={`/researchers/${r.slug}`} className="flex min-w-0 items-center gap-3">
              <Avatar name={r.displayName} src={r.photoUrl ?? undefined} size="sm" />
              <span className="min-w-0">
                <span className="block truncate font-medium text-rt-blue hover:underline">{r.displayName}</span>
                {r.academicRank ? <span className="block truncate text-xs text-rt-muted">{r.academicRank}</span> : null}
              </span>
            </Link>
            {viewerResearcherId && viewerResearcherId !== r.id ? (
              <FollowButton researcherId={r.id} initialFollowing={followed.has(r.id)} name={r.displayName} />
            ) : null}
          </Card>
        </li>
      ))}
    </ul>
  );
}
