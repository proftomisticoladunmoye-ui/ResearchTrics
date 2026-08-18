'use client';

import { useState } from 'react';
import { Button, Alert } from '@researchtrics/ui';

/** Admin: enqueue the weekly engagement digest to the worker now (§41). */
export function DigestTriggerButton() {
  const [state, setState] = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  const [msg, setMsg] = useState<string | null>(null);

  async function onClick() {
    setState('working');
    setMsg(null);
    try {
      const res = await fetch('/api/v1/admin/notifications/digest', { method: 'POST' });
      if (res.ok) {
        setState('done');
        setMsg('Digest job queued — the worker will build + send digests to verified users with recent activity.');
      } else {
        const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        setState('error');
        setMsg(body.error?.message ?? 'Could not queue the digest (is REDIS_URL set on the web service?).');
      }
    } catch {
      setState('error');
      setMsg('Network error.');
    }
  }

  return (
    <div className="space-y-3">
      <Button onClick={onClick} disabled={state === 'working'} size="sm">
        {state === 'working' ? 'Queuing…' : 'Send weekly digests now'}
      </Button>
      {msg ? <Alert variant={state === 'error' ? 'error' : 'success'}>{msg}</Alert> : null}
    </div>
  );
}
