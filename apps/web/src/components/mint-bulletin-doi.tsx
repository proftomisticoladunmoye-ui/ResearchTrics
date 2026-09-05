'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Button } from '@researchtrics/ui';

/**
 * Admin: mint a DOI for a published bulletin (Zenodo/DataCite, per server
 * config). Permanent once registered, so we confirm first.
 */
export function MintBulletinDoi({ id, provider, existingDoi }: { id: string; provider: string; existingDoi: string | null }) {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'minting' | 'done' | 'error'>(existingDoi ? 'done' : 'idle');
  const [doi, setDoi] = useState<string | null>(existingDoi);
  const [message, setMessage] = useState<string | null>(null);

  async function mint() {
    if (!window.confirm(`Mint a permanent DOI via ${provider}? A registered DOI cannot be deleted.`)) return;
    setState('minting');
    setMessage(null);
    try {
      const res = await fetch(`/api/v1/admin/research-bulletin/${id}/doi`, { method: 'POST' });
      const body = (await res.json().catch(() => ({}))) as { data?: { doi?: string; provider?: string }; error?: { message?: string } };
      if (!res.ok || !body.data?.doi) {
        setState('error');
        setMessage(body.error?.message ?? 'Could not mint a DOI.');
        return;
      }
      setDoi(body.data.doi);
      setState('done');
      setMessage(`DOI registered via ${body.data.provider}.`);
      router.refresh();
    } catch {
      setState('error');
      setMessage('Network error.');
    }
  }

  return (
    <Card className="mt-4 p-5">
      <h2 className="text-sm font-semibold text-rt-text">Digital Object Identifier (DOI)</h2>
      {doi ? (
        <p className="mt-1 text-sm text-rt-text">
          Registered:{' '}
          <a className="text-rt-blue hover:underline" href={`https://doi.org/${doi}`} target="_blank" rel="noopener noreferrer">
            https://doi.org/{doi}
          </a>
        </p>
      ) : (
        <>
          <p className="mt-1 text-xs text-rt-muted">
            Mint a permanent, citable DOI via <strong>{provider}</strong>. The bulletin must be published first.
          </p>
          <div className="mt-2">
            <Button onClick={mint} size="sm" variant="accent" disabled={state === 'minting'}>
              {state === 'minting' ? 'Minting…' : 'Mint DOI'}
            </Button>
          </div>
        </>
      )}
      {message ? <p className={`mt-2 text-xs ${state === 'error' ? 'text-rt-error' : 'text-rt-success'}`}>{message}</p> : null}
    </Card>
  );
}
