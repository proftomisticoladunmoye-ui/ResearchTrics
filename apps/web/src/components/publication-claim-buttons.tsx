'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@researchtrics/ui';

/** Claim or dispute a candidate publication (Discovery Engine §14, §15). */
export function PublicationClaimButtons({
  researcherId,
  publicationId,
  claimed,
}: {
  researcherId: string;
  publicationId: string;
  claimed: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function decide(decision: 'claimed' | 'disputed') {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/v1/researchers/${researcherId}/publications/${publicationId}/claim`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ decision }),
        },
      );
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex gap-2">
      {claimed ? (
        <Button size="sm" variant="ghost" onClick={() => decide('disputed')} disabled={busy}>
          {busy ? '…' : 'Not mine'}
        </Button>
      ) : (
        <Button size="sm" onClick={() => decide('claimed')} disabled={busy}>
          {busy ? '…' : 'This is mine'}
        </Button>
      )}
    </span>
  );
}
