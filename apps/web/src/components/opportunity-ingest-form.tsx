'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Field, Alert } from '@researchtrics/ui';

interface IngestResult {
  source: string;
  fetched: number;
  created: number;
  updated: number;
}

/** Admin control to run opportunity ingestion on demand (§20). */
export function OpportunityIngestForm() {
  const router = useRouter();
  const [status, setStatus] = useState<'idle' | 'running' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<IngestResult | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('running');
    setMessage(null);
    setResult(null);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch('/api/v1/admin/opportunities/ingest', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ source: fd.get('source'), rows: 100 }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        data?: IngestResult;
        error?: { message?: string };
      };
      if (!res.ok || !body.data) {
        setStatus('error');
        setMessage(body.error?.message ?? 'Ingestion failed');
        return;
      }
      setResult(body.data);
      setStatus('idle');
      router.refresh();
    } catch {
      setStatus('error');
      setMessage('Network error');
    }
  }

  const inputClass =
    'w-full rounded border border-rt-border bg-rt-white px-3 py-2 text-sm text-rt-text';

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Field label="Source" htmlFor="source">
        <select id="source" name="source" className={inputClass} defaultValue="grants_gov">
          <option value="grants_gov">Grants.gov (US federal — live)</option>
          <option value="eu_funding">EU Funding &amp; Tenders (verify on first run)</option>
          <option value="fixture">Fixture (offline sample)</option>
        </select>
      </Field>
      <p className="text-xs text-rt-muted">
        Pulls up to 100 open listings, deduped by source — safe to run repeatedly.
      </p>
      <Button type="submit" disabled={status === 'running'}>
        {status === 'running' ? 'Ingesting…' : 'Run ingestion now'}
      </Button>
      {message ? <Alert variant="error">{message}</Alert> : null}
      {result ? (
        <Alert variant="success">
          {result.source}: fetched {result.fetched}, created {result.created}, updated {result.updated}.
        </Alert>
      ) : null}
    </form>
  );
}
