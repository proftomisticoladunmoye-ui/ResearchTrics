'use client';

import { useState } from 'react';

/** Invite a colleague to claim an unclaimed profile (Discovery Engine §19). */
export function ReferButton({ researcherId }: { researcherId: string }) {
  const [state, setState] = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  const [url, setUrl] = useState<string | null>(null);

  async function refer() {
    setState('working');
    try {
      const res = await fetch(`/api/v1/researchers/${researcherId}/invite`, { method: 'POST' });
      const b = (await res.json().catch(() => ({}))) as { data?: { claimUrl?: string } };
      if (res.ok && b.data?.claimUrl) {
        setUrl(b.data.claimUrl);
        setState('done');
        await navigator.clipboard?.writeText(b.data.claimUrl).catch(() => {});
      } else {
        setState('error');
      }
    } catch {
      setState('error');
    }
  }

  if (state === 'done' && url) {
    return <span className="text-xs text-rt-success">Claim link copied ✓</span>;
  }
  return (
    <button
      onClick={refer}
      disabled={state === 'working'}
      className="text-sm text-rt-muted hover:underline disabled:opacity-60"
    >
      {state === 'working' ? 'Creating link…' : 'Invite this researcher'}
    </button>
  );
}
