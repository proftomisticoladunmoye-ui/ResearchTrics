'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Alert } from '@researchtrics/ui';

/**
 * Claim / opt-out controls for an unclaimed profile (Discovery Engine §11–§13,
 * §35). ORCID is the preferred verification and is recommended when configured;
 * the account-email path proves control of the account. Nothing here asserts
 * ownership before verification (§68).
 */
export function ClaimActions({
  researcherId,
  slug,
  hasOrcid,
  emphasizeRemoval,
}: {
  researcherId: string;
  slug: string;
  hasOrcid: boolean;
  emphasizeRemoval: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<'claim' | 'remove' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function claim() {
    setBusy('claim');
    setError(null);
    try {
      const res = await fetch(`/api/v1/researchers/${researcherId}/claim`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ method: 'institution' }),
      });
      if (res.ok) {
        router.push(`/researchers/${slug}?claimed=1`);
        router.refresh();
      } else {
        const b = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        setError(b.error?.message ?? 'Could not claim this profile');
        setBusy(null);
      }
    } catch {
      setError('Network error');
      setBusy(null);
    }
  }

  async function remove() {
    setBusy('remove');
    setError(null);
    try {
      const res = await fetch(`/api/v1/researchers/${researcherId}/removal`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason: 'not me' }),
      });
      if (res.ok) {
        router.push('/');
        router.refresh();
      } else {
        const b = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        setError(b.error?.message ?? 'Could not process the request');
        setBusy(null);
      }
    } catch {
      setError('Network error');
      setBusy(null);
    }
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="rounded-lg border border-rt-border p-5">
        <h2 className="text-base font-semibold text-rt-text">Verify & claim</h2>
        <p className="mt-1 text-sm text-rt-muted">
          {hasOrcid
            ? 'This profile carries an ORCID iD. Verifying with ORCID (recommended) proves you own it; it requires an ORCID application to be configured.'
            : 'Verify to claim this profile.'}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button onClick={claim} disabled={busy !== null}>
            {busy === 'claim' ? 'Verifying…' : 'Verify with my account & claim'}
          </Button>
        </div>
      </div>

      <div className={`rounded-lg border p-5 ${emphasizeRemoval ? 'border-rt-error/40' : 'border-rt-border'}`}>
        <h2 className="text-base font-semibold text-rt-text">This isn&rsquo;t me</h2>
        <p className="mt-1 text-sm text-rt-muted">
          Request that this unclaimed profile be removed from public discovery.
        </p>
        <Button variant="ghost" className="mt-3" onClick={remove} disabled={busy !== null}>
          {busy === 'remove' ? 'Submitting…' : 'Request removal'}
        </Button>
      </div>

      {error ? <Alert variant="error" title="Something went wrong">{error}</Alert> : null}
    </div>
  );
}
