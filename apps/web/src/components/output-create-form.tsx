'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Field, Alert } from '@researchtrics/ui';

export interface OutputField {
  name: string;
  label: string;
  type?: 'text' | 'textarea' | 'number' | 'select';
  options?: { value: string; label: string }[];
  required?: boolean;
  placeholder?: string;
}

const textareaClass =
  'w-full rounded border border-rt-border bg-rt-white px-3 py-2 text-sm text-rt-text placeholder:text-rt-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rt-blue-royal';

export function OutputCreateForm({
  endpoint,
  basePath,
  fields,
  submitLabel,
}: {
  endpoint: string;
  basePath: string;
  fields: OutputField[];
  submitLabel: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('saving');
    setMessage(null);
    const fd = new FormData(e.currentTarget);
    const payload: Record<string, unknown> = {};
    for (const f of fields) {
      const raw = fd.get(f.name);
      if (raw == null || raw === '') continue;
      payload[f.name] = f.type === 'number' ? Number(raw) : String(raw);
    }
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => ({}))) as {
        data?: { slug: string };
        error?: { message?: string };
      };
      if (!res.ok || !body.data) {
        setStatus('error');
        setMessage(body.error?.message ?? 'Could not save. Please check the fields.');
        return;
      }
      router.push(`${basePath}/${body.data.slug}`);
      router.refresh();
    } catch {
      setStatus('error');
      setMessage('Network error. Please try again.');
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {status === 'error' && message ? <Alert variant="error">{message}</Alert> : null}
      {fields.map((f) => (
        <Field key={f.name} label={f.label} htmlFor={`f-${f.name}`}>
          {f.type === 'textarea' ? (
            <textarea id={`f-${f.name}`} name={f.name} rows={3} className={textareaClass} placeholder={f.placeholder} />
          ) : f.type === 'select' ? (
            <select id={`f-${f.name}`} name={f.name} className={textareaClass} defaultValue="">
              {f.options?.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : (
            <Input
              id={`f-${f.name}`}
              name={f.name}
              type={f.type === 'number' ? 'number' : 'text'}
              required={f.required}
              placeholder={f.placeholder}
            />
          )}
        </Field>
      ))}
      <div>
        <Button type="submit" disabled={status === 'saving'}>
          {status === 'saving' ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
