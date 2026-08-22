'use client';

import { useState } from 'react';
import { Button } from '@researchtrics/ui';

/** Admin: send a test email to yourself to verify the transport works. */
export function EmailTestButton() {
  const [state, setState] = useState<'idle' | 'sending'>('idle');
  const [msg, setMsg] = useState<string | null>(null);

  async function send() {
    setState('sending');
    setMsg(null);
    try {
      const res = await fetch('/api/v1/admin/email/test', { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        const provider = json?.data?.provider as string | undefined;
        setMsg(
          provider === 'ResendEmailProvider'
            ? `Sent via Resend to ${json.data.to} — check your inbox (and spam).`
            : `Sent, but via the console provider (${provider}) — set EMAIL_PROVIDER=resend + EMAIL_API_KEY on this service; no email was actually delivered.`,
        );
      } else {
        setMsg(json?.error?.message ?? 'Failed to send. Check the email settings.');
      }
    } catch {
      setMsg('Network error.');
    } finally {
      setState('idle');
    }
  }

  return (
    <div>
      <Button onClick={send} disabled={state === 'sending'} size="sm">
        {state === 'sending' ? 'Sending…' : 'Send test email to me'}
      </Button>
      {msg ? <p className="mt-2 text-sm text-rt-muted">{msg}</p> : null}
    </div>
  );
}
