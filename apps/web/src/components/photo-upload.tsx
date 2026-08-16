'use client';

import { useState, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Avatar, Alert } from '@researchtrics/ui';

/**
 * Profile photo upload. Uploads the image to object storage (public) via
 * /api/v1/files, then saves the returned URL to the researcher's photoUrl.
 */
export function PhotoUpload({ name, currentUrl }: { name: string; currentUrl?: string | null }) {
  const router = useRouter();
  const [status, setStatus] = useState<'idle' | 'uploading' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | undefined>(currentUrl ?? undefined);

  async function onChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setStatus('error');
      setMessage('Please choose an image (PNG or JPEG).');
      return;
    }
    setStatus('uploading');
    setMessage(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('accessLevel', 'public');
      const up = await fetch('/api/v1/files', { method: 'POST', body: fd });
      const upBody = (await up.json().catch(() => ({}))) as {
        data?: { url: string };
        error?: { message?: string };
      };
      if (!up.ok || !upBody.data) {
        setStatus('error');
        setMessage(upBody.error?.message ?? 'Upload failed.');
        return;
      }
      const res = await fetch('/api/v1/researchers/me', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ photoUrl: upBody.data.url }),
      });
      if (!res.ok) {
        setStatus('error');
        setMessage('Could not save photo.');
        return;
      }
      setPreview(upBody.data.url);
      setStatus('idle');
      router.refresh();
    } catch {
      setStatus('error');
      setMessage('Network error during upload.');
    }
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar name={name} src={preview} size="lg" />
      <div>
        <label className="inline-block">
          <span className="sr-only">Upload profile photo</span>
          <input type="file" accept="image/png,image/jpeg" onChange={onChange} className="text-sm" />
        </label>
        <p className="mt-1 text-xs text-rt-muted">
          {status === 'uploading' ? 'Uploading…' : 'PNG or JPEG, up to 25 MB.'}
        </p>
        {message ? (
          <div className="mt-2">
            <Alert variant="error">{message}</Alert>
          </div>
        ) : null}
      </div>
    </div>
  );
}
