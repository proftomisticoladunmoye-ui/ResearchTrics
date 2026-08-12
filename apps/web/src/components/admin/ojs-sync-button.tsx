'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@researchtrics/ui';

export function OjsSyncButton({ sourceId }: { sourceId: string }) {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'working' | 'queued' | 'error'>('idle');

  async function onSync() {
    setState('working');
    try {
      const res = await fetch(`/api/v1/admin/ojs/sources/${sourceId}/sync`, { method: 'POST' });
      setState(res.ok ? 'queued' : 'error');
      setTimeout(() => router.refresh(), 800);
    } catch {
      setState('error');
    }
  }

  return (
    <Button size="sm" variant="secondary" onClick={onSync} disabled={state === 'working'}>
      {state === 'working' ? 'Queuing…' : state === 'queued' ? 'Queued ✓' : state === 'error' ? 'Failed' : 'Sync now'}
    </Button>
  );
}
