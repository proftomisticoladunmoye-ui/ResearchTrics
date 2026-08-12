'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@researchtrics/ui';

export function RvmRecalculate() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    setBusy(true);
    try {
      await fetch('/api/v1/rvm/recompute', { method: 'POST' });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="secondary" size="sm" onClick={onClick} disabled={busy}>
      {busy ? 'Recalculating…' : 'Recalculate'}
    </Button>
  );
}
