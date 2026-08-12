'use client';

import { useState } from 'react';
import { Button } from '@researchtrics/ui';

export function ConnectButton({ toResearcherId }: { toResearcherId: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [msg, setMsg] = useState<string | null>(null);

  async function onClick() {
    setState('sending');
    setMsg(null);
    try {
      const res = await fetch('/api/v1/collaboration/requests', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ toResearcherId }),
      });
      if (res.ok) {
        setState('sent');
      } else {
        const b = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        setState('error');
        setMsg(b.error?.message ?? 'Could not send request');
      }
    } catch {
      setState('error');
      setMsg('Network error');
    }
  }

  if (state === 'sent') return <Button size="sm" variant="secondary" disabled>Request sent ✓</Button>;
  return (
    <span className="inline-flex items-center gap-2">
      <Button size="sm" onClick={onClick} disabled={state === 'sending'}>
        {state === 'sending' ? 'Sending…' : 'Request collaboration'}
      </Button>
      {state === 'error' && msg ? <span className="text-xs text-rt-error">{msg}</span> : null}
    </span>
  );
}
