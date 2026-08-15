'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Field, Alert } from '@researchtrics/ui';

interface UploadResult {
  id: string;
  storageKey: string;
  url: string;
  pdfHasText: boolean | null;
}

const ACCEPT = 'application/pdf,image/png,image/jpeg,text/csv,application/zip,application/json';
const MAX_BYTES = 25 * 1024 * 1024;

/**
 * Dashboard file-upload control (Spec §46). Posts multipart form-data to
 * /api/v1/files; the server enforces MIME allow-list, size cap, and (for PDFs)
 * the extractable-text requirement. Access level is chosen here.
 */
export function FileUpload() {
  const router = useRouter();
  const [status, setStatus] = useState<'idle' | 'uploading' | 'error' | 'done'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const file = fd.get('file');
    if (!(file instanceof File) || file.size === 0) {
      setStatus('error');
      setMessage('Choose a file to upload.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setStatus('error');
      setMessage('File exceeds the 25 MB limit.');
      return;
    }

    setStatus('uploading');
    setMessage(null);
    try {
      const res = await fetch('/api/v1/files', { method: 'POST', body: fd });
      const body = (await res.json().catch(() => ({}))) as {
        data?: UploadResult;
        error?: { message?: string };
      };
      if (!res.ok || !body.data) {
        setStatus('error');
        setMessage(body.error?.message ?? 'Upload failed.');
        return;
      }
      setStatus('done');
      setMessage(`Uploaded “${file.name}”.`);
      form.reset();
      router.refresh();
    } catch {
      setStatus('error');
      setMessage('Network error during upload.');
    }
  }

  const inputClass =
    'w-full rounded border border-rt-border bg-rt-white px-3 py-2 text-sm text-rt-text';

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="File" htmlFor="file">
        <input
          id="file"
          name="file"
          type="file"
          accept={ACCEPT}
          required
          className={inputClass}
        />
        <p className="mt-1 text-xs text-rt-muted">
          PDF, PNG, JPEG, CSV, ZIP, or JSON. Max 25 MB. Scanned image-only PDFs are rejected
          (they are not indexable — Google Scholar requirement).
        </p>
      </Field>

      <Field label="Who can access this file?" htmlFor="accessLevel">
        <select id="accessLevel" name="accessLevel" className={inputClass} defaultValue="public">
          <option value="public">Public — anyone</option>
          <option value="restricted">Restricted — signed-in researchers</option>
          <option value="request">On request</option>
          <option value="embargoed">Embargoed — only me for now</option>
          <option value="private">Private — only me</option>
        </select>
      </Field>

      {message ? (
        <Alert variant={status === 'error' ? 'error' : 'success'}>{message}</Alert>
      ) : null}

      <Button type="submit" disabled={status === 'uploading'}>
        {status === 'uploading' ? 'Uploading…' : 'Upload file'}
      </Button>
    </form>
  );
}
