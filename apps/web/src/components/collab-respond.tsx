'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@researchtrics/ui';

export function CollabRespond({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function respond(accept: boolean) {
    setBusy(true);
    try {
      await fetch(`/api/v1/collaboration/requests/${requestId}/respond`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ accept }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex gap-2">
      <Button size="sm" onClick={() => respond(true)} disabled={busy}>
        Accept
      </Button>
      <Button size="sm" variant="secondary" onClick={() => respond(false)} disabled={busy}>
        Decline
      </Button>
    </span>
  );
}
