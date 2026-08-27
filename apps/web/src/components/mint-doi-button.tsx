'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@researchtrics/ui';

/**
 * Mint a DataCite DOI for a publication that has none. Shown only to an author
 * when DOI minting is configured. Minting a findable DOI is permanent, so we
 * confirm first.
 */
export function MintDoiButton({ slug }: { slug: string }) {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'minting' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  async function mint() {
    if (!window.confirm('Mint a permanent, citable DOI for this work? A DOI cannot be deleted once registered.')) {
      return;
    }
    setState('minting');
    setMessage(null);
    try {
      const res = await fetch(`/api/v1/publications/${slug}/mint-doi`, { method: 'POST' });
      const body = (await res.json().catch(() => ({}))) as {
        data?: { doi?: string; status?: string };
        error?: { message?: string };
      };
      if (!res.ok || !body.data?.doi) {
        setState('error');
        setMessage(body.error?.message ?? 'Could not mint a DOI. Please try again.');
        return;
      }
      setState('done');
      setMessage(`DOI ${body.data.doi} registered.`);
      router.refresh();
    } catch {
      setState('error');
      setMessage('Network error. Please try again.');
    }
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <Button onClick={mint} size="sm" variant="secondary" disabled={state === 'minting' || state === 'done'}>
        {state === 'minting' ? 'Minting DOI…' : state === 'done' ? 'DOI minted' : 'Mint a DOI'}
      </Button>
      {message ? (
        <span className={`text-xs ${state === 'error' ? 'text-rt-error' : 'text-rt-success'}`}>{message}</span>
      ) : null}
    </span>
  );
}
