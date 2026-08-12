'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Field, Alert } from '@researchtrics/ui';

export function AddOjsSourceForm() {
  const router = useRouter();
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('saving');
    setMessage(null);
    const f = new FormData(e.currentTarget);
    try {
      const res = await fetch('/api/v1/admin/ojs/sources', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: String(f.get('name') ?? ''),
          baseUrl: String(f.get('baseUrl') ?? ''),
          siteId: String(f.get('siteId') ?? '') || undefined,
          apiToken: String(f.get('apiToken') ?? '') || undefined,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        data?: { versionDetected?: string };
        error?: { message?: string };
      };
      if (!res.ok) {
        setStatus('error');
        setMessage(body.error?.message ?? 'Could not add the OJS source.');
        return;
      }
      setStatus('idle');
      (e.target as HTMLFormElement).reset();
      router.refresh();
    } catch {
      setStatus('error');
      setMessage('Network error. Please try again.');
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {status === 'error' && message ? <Alert variant="error">{message}</Alert> : null}
      <Field label="Name" htmlFor="ojs-name">
        <Input id="ojs-name" name="name" placeholder="Demo Journal Platform" required />
      </Field>
      <Field label="Base URL" htmlFor="ojs-base">
        <Input id="ojs-base" name="baseUrl" type="url" placeholder="http://localhost:8081" required />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Site ID (optional)" htmlFor="ojs-site">
          <Input id="ojs-site" name="siteId" />
        </Field>
        <Field label="API token (optional)" htmlFor="ojs-token">
          <Input id="ojs-token" name="apiToken" type="password" autoComplete="off" />
        </Field>
      </div>
      <p className="text-xs text-rt-muted">
        On add, the installation is probed for its OAI-PMH endpoint and version — nothing is
        assumed. The token is encrypted at rest.
      </p>
      <div>
        <Button type="submit" disabled={status === 'saving'}>
          {status === 'saving' ? 'Probing…' : 'Add & probe source'}
        </Button>
      </div>
    </form>
  );
}
