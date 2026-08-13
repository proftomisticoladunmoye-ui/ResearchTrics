'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@researchtrics/ui';

/** Bookmark / un-bookmark an opportunity (signed-in researchers only). */
export function OpportunitySaveButton({
  opportunityId,
  initialSaved,
}: {
  opportunityId: string;
  initialSaved: boolean;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initialSaved);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    const next = !saved;
    try {
      const res = await fetch(`/api/v1/opportunities/${opportunityId}/save`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ saved: next }),
      });
      if (res.ok) {
        setSaved(next);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button size="sm" variant={saved ? 'secondary' : 'primary'} onClick={toggle} disabled={busy}>
      {saved ? 'Saved ✓' : 'Save'}
    </Button>
  );
}
