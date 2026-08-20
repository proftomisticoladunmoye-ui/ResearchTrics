'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@researchtrics/ui';

/**
 * Follow / unfollow a researcher. Optimistic, with a compact label. Shown only
 * to signed-in researchers viewing someone else's profile/work.
 */
export function FollowButton({
  researcherId,
  initialFollowing,
  name,
}: {
  researcherId: string;
  initialFollowing: boolean;
  name?: string;
}) {
  const router = useRouter();
  const [following, setFollowing] = useState(initialFollowing);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    const next = !following;
    setBusy(true);
    setFollowing(next); // optimistic
    try {
      const res = await fetch(`/api/v1/researchers/${researcherId}/follow`, {
        method: next ? 'POST' : 'DELETE',
      });
      if (!res.ok) {
        setFollowing(!next); // revert
      } else {
        router.refresh(); // update follower counts
      }
    } catch {
      setFollowing(!next);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      onClick={toggle}
      disabled={busy}
      size="sm"
      variant={following ? 'secondary' : 'primary'}
      aria-pressed={following}
      aria-label={following ? `Unfollow${name ? ` ${name}` : ''}` : `Follow${name ? ` ${name}` : ''}`}
    >
      {following ? 'Following' : 'Follow'}
    </Button>
  );
}
