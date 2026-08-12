'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@researchtrics/ui';

/**
 * Institution-admin control to confirm or revoke an affiliation. Posts to the
 * RBAC-guarded API and refreshes the server-rendered portal on success.
 */
export function AffiliationVerify({
  affiliationId,
  verified,
}: {
  affiliationId: string;
  verified: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(next: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/affiliations/${affiliationId}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ verified: next }),
      });
      if (res.ok) {
        router.refresh();
      } else {
        const b = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        setError(b.error?.message ?? 'Action failed');
      }
    } catch {
      setError('Network error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      {verified ? (
        <Button size="sm" variant="ghost" onClick={() => submit(false)} disabled={busy}>
          {busy ? '…' : 'Revoke'}
        </Button>
      ) : (
        <Button size="sm" onClick={() => submit(true)} disabled={busy}>
          {busy ? 'Verifying…' : 'Verify'}
        </Button>
      )}
      {error ? <span className="text-xs text-rt-error">{error}</span> : null}
    </span>
  );
}
