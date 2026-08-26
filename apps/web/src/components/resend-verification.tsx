'use client';

import { useState } from 'react';
import { Button } from '@researchtrics/ui';

/**
 * Resend the email-verification link. The path to Level 1 verification — shown
 * on the profile when the researcher is still unverified. Now that the email
 * provider is configured, one click delivers a fresh link.
 */
export function ResendVerification({ email }: { email: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  async function send() {
    setState('sending');
    setMessage(null);
    try {
      const res = await fetch('/api/v1/auth/resend-verification', { method: 'POST' });
      const body = (await res.json().catch(() => ({}))) as {
        data?: { sent?: boolean; alreadyVerified?: boolean };
        error?: { message?: string };
      };
      if (!res.ok) {
        setState('error');
        setMessage(body.error?.message ?? 'Could not send the verification email.');
        return;
      }
      if (body.data?.alreadyVerified) {
        setState('sent');
        setMessage('Your email is already verified — refresh to see your status.');
        return;
      }
      setState('sent');
      setMessage(`Verification email sent to ${email}. Check your inbox (and spam) for the link.`);
    } catch {
      setState('error');
      setMessage('Network error. Please try again.');
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button onClick={send} size="sm" variant="secondary" disabled={state === 'sending' || state === 'sent'}>
        {state === 'sending' ? 'Sending…' : state === 'sent' ? 'Sent' : 'Send verification email'}
      </Button>
      {message ? (
        <p className={`text-xs ${state === 'error' ? 'text-rt-error' : 'text-rt-success'}`}>{message}</p>
      ) : null}
    </div>
  );
}
