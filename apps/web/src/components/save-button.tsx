'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@researchtrics/ui';

/** Save / unsave (bookmark) a publication. Optimistic. */
export function SaveButton({ slug, initialSaved }: { slug: string; initialSaved: boolean }) {
  const router = useRouter();
  const [saved, setSaved] = useState(initialSaved);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    const next = !saved;
    setBusy(true);
    setSaved(next);
    try {
      const res = await fetch(`/api/v1/publications/${slug}/save`, { method: next ? 'POST' : 'DELETE' });
      if (!res.ok) setSaved(!next);
      else router.refresh();
    } catch {
      setSaved(!next);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button onClick={toggle} disabled={busy} size="sm" variant="secondary" aria-pressed={saved}>
      {saved ? '★ Saved' : '☆ Save'}
    </Button>
  );
}
