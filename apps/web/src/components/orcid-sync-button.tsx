'use client';

import { useState } from 'react';
import { Button } from '@researchtrics/ui';

/**
 * Add this work to the author's ORCID record. Shown to an author when ORCID work
 * sync is enabled. Clear guidance is returned by the API when the author needs
 * to connect (or reconnect for the update scope).
 */
export function OrcidSyncButton({ slug, initialSynced }: { slug: string; initialSynced: boolean }) {
  const [state, setState] = useState<'idle' | 'syncing' | 'done' | 'error'>(initialSynced ? 'done' : 'idle');
  const [message, setMessage] = useState<string | null>(null);

  async function sync() {
    setState('syncing');
    setMessage(null);
    try {
      const res = await fetch(`/api/v1/publications/${slug}/orcid-sync`, { method: 'POST' });
      const body = (await res.json().catch(() => ({}))) as {
        data?: { status?: string };
        error?: { message?: string };
      };
      if (!res.ok) {
        setState('error');
        setMessage(body.error?.message ?? 'Could not add this work to ORCID.');
        return;
      }
      setState('done');
      setMessage('Added to your ORCID record.');
    } catch {
      setState('error');
      setMessage('Network error. Please try again.');
    }
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <Button onClick={sync} size="sm" variant="secondary" disabled={state === 'syncing' || state === 'done'}>
        {state === 'syncing' ? 'Adding to ORCID…' : state === 'done' ? '✓ In your ORCID' : 'Add to my ORCID'}
      </Button>
      {message ? (
        <span className={`text-xs ${state === 'error' ? 'text-rt-error' : 'text-rt-success'}`}>{message}</span>
      ) : null}
    </span>
  );
}
