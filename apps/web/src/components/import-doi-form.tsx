'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Alert } from '@researchtrics/ui';

export function ImportDoiForm() {
  const router = useRouter();
  const [status, setStatus] = useState<'idle' | 'importing' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('importing');
    setMessage(null);
    const doi = String(new FormData(e.currentTarget).get('doi') ?? '');
    try {
      const res = await fetch('/api/v1/publications/import', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ doi }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        data?: { status: string; slug: string };
        error?: { message?: string };
      };
      if (!res.ok || !body.data) {
        setStatus('error');
        setMessage(body.error?.message ?? 'Import failed. Check the DOI and try again.');
        return;
      }
      router.push(`/publications/${body.data.slug}`);
      router.refresh();
    } catch {
      setStatus('error');
      setMessage('Network error. Please try again.');
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      {status === 'error' && message ? <Alert variant="error">{message}</Alert> : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          name="doi"
          placeholder="10.1234/example or https://doi.org/…"
          aria-label="DOI"
          required
        />
        <Button type="submit" disabled={status === 'importing'}>
          {status === 'importing' ? 'Importing…' : 'Import by DOI'}
        </Button>
      </div>
      <p className="text-xs text-rt-muted">
        Metadata is fetched from Crossref (authoritative) and enriched with OpenAlex. Duplicates are
        detected by DOI.
      </p>
    </form>
  );
}
