'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Card } from '@researchtrics/ui';

/** Admin: create a collection or series, then jump to its editor to add members. */
export function CollectionCreate() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<'collection' | 'series'>('collection');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (title.trim().length < 3) { setError('A title of at least 3 characters is required.'); return; }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/admin/research-bulletin/collections', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title, kind }),
      });
      const body = (await res.json().catch(() => ({}))) as { data?: { id: string }; error?: { message?: string } };
      if (!res.ok || !body.data) { setError(body.error?.message ?? 'Could not create.'); return; }
      router.push(`/admin/research-bulletin/collections/${body.data.id}`);
    } catch {
      setError('Network error.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex-1 min-w-[200px]">
          <span className="mb-1 block text-xs font-medium text-rt-muted">New collection / series title</span>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Advanced Psychometrics Series" />
        </label>
        <label>
          <span className="mb-1 block text-xs font-medium text-rt-muted">Kind</span>
          <select value={kind} onChange={(e) => setKind(e.target.value as 'collection' | 'series')} className="rounded border border-rt-border bg-rt-white p-2 text-sm">
            <option value="collection">Collection (unordered)</option>
            <option value="series">Series (ordered)</option>
          </select>
        </label>
        <Button onClick={create} size="sm" disabled={busy}>{busy ? 'Creating…' : 'Create'}</Button>
      </div>
      {error ? <p className="mt-2 text-xs text-rt-error">{error}</p> : null}
    </Card>
  );
}
