'use client';

import { useState } from 'react';
import { Button } from '@researchtrics/ui';

/** Recommend a publication — notifies its authors (§41). */
export function RecommendButton({ slug }: { slug: string }) {
  const [state, setState] = useState<'idle' | 'working' | 'done' | 'error'>('idle');

  async function onClick() {
    if (state === 'done') return;
    setState('working');
    try {
      const res = await fetch(`/api/v1/publications/${slug}/recommend`, { method: 'POST' });
      setState(res.ok ? 'done' : 'error');
    } catch {
      setState('error');
    }
  }

  return (
    <Button variant="secondary" size="sm" onClick={onClick} disabled={state === 'working' || state === 'done'}>
      {state === 'done' ? 'Recommended ✓' : state === 'working' ? 'Recommending…' : '👍 Recommend'}
    </Button>
  );
}
