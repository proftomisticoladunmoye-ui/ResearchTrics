'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Badge } from '@researchtrics/ui';

interface Candidate {
  rorId?: string;
  name: string;
  acronyms: string[];
  country?: string;
}

/** Resolve an institution against ROR and link the canonical match (§8). */
export function RorNormalizer({ institutionId, currentRorId }: { institutionId: string; currentRorId: string | null }) {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'searching' | 'linking'>('idle');
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function resolve() {
    setState('searching');
    setError(null);
    try {
      const res = await fetch(`/api/v1/institutions/${institutionId}/resolve-ror`, { method: 'POST' });
      const b = (await res.json().catch(() => ({}))) as { data?: { candidates: Candidate[] }; error?: { message?: string } };
      if (res.ok && b.data) setCandidates(b.data.candidates);
      else setError(b.error?.message ?? 'Could not search ROR');
    } catch {
      setError('Network error');
    } finally {
      setState('idle');
    }
  }

  async function link(rorId: string) {
    setState('linking');
    try {
      const res = await fetch(`/api/v1/institutions/${institutionId}/link-ror`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ rorId }),
      });
      if (res.ok) router.refresh();
      else {
        const b = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        setError(b.error?.message ?? 'Could not link');
      }
    } finally {
      setState('idle');
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        {currentRorId ? (
          <Badge variant="success" className="font-mono">ROR {currentRorId}</Badge>
        ) : (
          <Badge variant="outline">No ROR link</Badge>
        )}
        <Button size="sm" variant="secondary" onClick={resolve} disabled={state !== 'idle'}>
          {state === 'searching' ? 'Searching ROR…' : 'Find ROR match'}
        </Button>
      </div>

      {error ? <p className="mt-2 text-xs text-rt-error">{error}</p> : null}

      {candidates != null ? (
        candidates.length === 0 ? (
          <p className="mt-3 text-sm text-rt-muted">
            No ROR candidates found (ROR may not be configured in this environment).
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {candidates.map((c) => (
              <li key={c.rorId ?? c.name} className="flex items-center justify-between gap-3 text-sm">
                <span>
                  <span className="text-rt-text">{c.name}</span>
                  {c.acronyms.length > 0 ? <span className="text-rt-muted"> ({c.acronyms.join(', ')})</span> : null}
                  {c.country ? <span className="text-rt-muted"> · {c.country}</span> : null}
                </span>
                {c.rorId ? (
                  <Button size="sm" onClick={() => link(c.rorId!)} disabled={state !== 'idle'}>
                    Link
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}
