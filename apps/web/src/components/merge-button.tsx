'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@researchtrics/ui';

/** Merge a duplicate profile into the chosen canonical one (Discovery Engine §24). */
export function MergeButton({
  canonicalId,
  duplicateId,
}: {
  canonicalId: string;
  duplicateId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function merge() {
    setBusy(true);
    try {
      const res = await fetch('/api/v1/admin/review/merge', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ canonicalId, duplicateId }),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button size="sm" variant="secondary" onClick={merge} disabled={busy}>
      {busy ? 'Merging…' : 'Merge into first'}
    </Button>
  );
}
