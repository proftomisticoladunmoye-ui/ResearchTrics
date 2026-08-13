'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Field, Alert } from '@researchtrics/ui';

interface RunResult {
  mode: 'inline' | 'enqueued';
  jobId?: string;
  discovered?: number;
  created?: number;
  matched?: number;
  suppressed?: number;
}

/** Admin control to start a discovery run (Discovery Engine §22). */
export function DiscoveryRunForm() {
  const router = useRouter();
  const [status, setStatus] = useState<'idle' | 'running' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('running');
    setMessage(null);
    setResult(null);
    const fd = new FormData(e.currentTarget);
    const payload: Record<string, unknown> = { provider: fd.get('provider') };
    for (const k of ['institution', 'country', 'topic', 'rorId', 'orcid']) {
      const v = fd.get(k);
      if (v) payload[k] = String(v);
    }
    const limit = fd.get('limit');
    if (limit) payload.limit = Number(limit);

    try {
      const res = await fetch('/api/v1/admin/discovery/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => ({}))) as { data?: RunResult; error?: { message?: string } };
      if (!res.ok || !body.data) {
        setStatus('error');
        setMessage(body.error?.message ?? 'Discovery failed');
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
      <Field label="Source" htmlFor="provider">
        <select id="provider" name="provider" className={inputClass} defaultValue="fixture">
          <option value="fixture">Fixture (offline prototype)</option>
          <option value="openalex">OpenAlex (enqueued)</option>
          <option value="crossref">Crossref (enqueued)</option>
        </select>
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Institution" htmlFor="institution">
          <Input id="institution" name="institution" placeholder="e.g. University X" />
        </Field>
        <Field label="Country (code)" htmlFor="country">
          <Input id="country" name="country" placeholder="e.g. GB" />
        </Field>
        <Field label="Topic" htmlFor="topic">
          <Input id="topic" name="topic" placeholder="e.g. psychometrics" />
        </Field>
        <Field label="ROR ID" htmlFor="rorId">
          <Input id="rorId" name="rorId" placeholder="https://ror.org/…" />
        </Field>
        <Field label="ORCID" htmlFor="orcid">
          <Input id="orcid" name="orcid" placeholder="0000-0000-0000-0000" />
        </Field>
        <Field label="Limit" htmlFor="limit">
          <Input id="limit" name="limit" type="number" placeholder="25" />
        </Field>
      </div>
      <Button type="submit" disabled={status === 'running'}>
        {status === 'running' ? 'Discovering…' : 'Discover researchers'}
      </Button>

      {status === 'error' && message ? <Alert variant="error" title="Failed">{message}</Alert> : null}
      {result ? (
        <Alert variant="success" title={result.mode === 'inline' ? 'Discovery complete' : 'Discovery enqueued'}>
          {result.mode === 'inline'
            ? `Discovered ${result.discovered} · created ${result.created} · matched ${result.matched}${result.suppressed ? ` · suppressed ${result.suppressed}` : ''}.`
            : `Job ${result.jobId} queued — results will appear once the worker processes it.`}
        </Alert>
      ) : null}
    </form>
  );
}
