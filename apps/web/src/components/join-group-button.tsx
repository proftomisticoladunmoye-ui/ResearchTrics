'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@researchtrics/ui';

export function JoinGroupButton({ groupId, isMember }: { groupId: string; isMember: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [joined, setJoined] = useState(isMember);

  async function onJoin() {
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/research-groups/${groupId}/join`, { method: 'POST' });
      if (res.ok) {
        setJoined(true);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  if (joined) return <Button size="sm" variant="secondary" disabled>Member ✓</Button>;
  return (
    <Button size="sm" onClick={onJoin} disabled={busy}>
      {busy ? 'Joining…' : 'Join group'}
    </Button>
  );
}
