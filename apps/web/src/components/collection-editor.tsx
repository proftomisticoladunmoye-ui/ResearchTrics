'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Card, Alert } from '@researchtrics/ui';

interface Member { id: string; number: number | null; title: string; status: string }
interface SearchItem { id: string; number: number | null; title: string; status: string }

export interface CollectionInitial {
  id: string;
  title: string;
  description: string;
  kind: 'collection' | 'series';
  published: boolean;
  members: Member[];
}

const input = 'w-full rounded border border-rt-border bg-rt-white px-3 py-2 text-sm text-rt-text';

export function CollectionEditor({ initial }: { initial: CollectionInitial }) {
  const router = useRouter();
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [kind, setKind] = useState(initial.kind);
  const [published, setPublished] = useState(initial.published);
  const [members, setMembers] = useState<Member[]>(initial.members);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<SearchItem[]>([]);
  const [msg, setMsg] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) { setResults([]); return; }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/v1/admin/research-bulletin/search?q=${encodeURIComponent(query)}`, { signal: ctrl.signal });
        if (!res.ok) return;
        const body = (await res.json()) as { data?: { items: SearchItem[] } };
        setResults(body.data?.items ?? []);
      } catch { /* aborted */ }
    }, 250);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q]);

  function addMember(it: SearchItem) {
    setQ('');
    setResults([]);
    if (members.some((m) => m.id === it.id)) return; // no duplicates
    setMembers((prev) => [...prev, { id: it.id, number: it.number, title: it.title, status: it.status }]);
  }

  function move(i: number, dir: -1 | 1) {
    setMembers((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/v1/admin/research-bulletin/collections/${initial.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title, description, kind, published, bulletinIds: members.map((m) => m.id) }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      if (!res.ok) { setMsg({ kind: 'error', text: body.error?.message ?? 'Could not save.' }); return; }
      setMsg({ kind: 'success', text: 'Saved.' });
      router.refresh();
    } catch {
      setMsg({ kind: 'error', text: 'Network error.' });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm('Delete this collection? The bulletins themselves are not affected.')) return;
    const res = await fetch(`/api/v1/admin/research-bulletin/collections/${initial.id}`, { method: 'DELETE' });
    if (res.ok) router.push('/admin/research-bulletin/collections');
  }

  return (
    <div className="space-y-4">
      {msg ? <Alert variant={msg.kind === 'error' ? 'error' : 'success'}>{msg.text}</Alert> : null}
      <Card className="space-y-3 p-5">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-rt-text">Title</span>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-rt-text">Description</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={input} />
        </label>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            Kind
            <select value={kind} onChange={(e) => setKind(e.target.value as 'collection' | 'series')} className="rounded border border-rt-border bg-rt-white p-2 text-sm">
              <option value="collection">Collection (unordered)</option>
              <option value="series">Series (ordered)</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} /> Published
          </label>
        </div>
      </Card>

      <Card className="space-y-3 p-5">
        <span className="text-sm font-semibold text-rt-text">Bulletins {kind === 'series' ? '(ordered)' : ''}</span>
        <div className="relative">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search published bulletins to add…" />
          {results.length > 0 ? (
            <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded border border-rt-border bg-rt-white shadow-lg">
              {results.map((r) => (
                <li key={r.id}>
                  <button type="button" onClick={() => addMember(r)} className="block w-full px-3 py-2 text-left text-xs hover:bg-rt-blue-light/30">
                    <span className="font-mono text-rt-muted">No. {r.number != null ? String(r.number).padStart(3, '0') : '—'}</span>{' '}
                    <span className="text-rt-text">{r.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {members.length === 0 ? (
          <p className="text-sm text-rt-muted">No bulletins yet. Search above to add.</p>
        ) : (
          <ol className="space-y-1">
            {members.map((m, i) => (
              <li key={m.id} className="flex items-center justify-between gap-2 rounded border border-rt-border px-3 py-2 text-sm">
                <span className="min-w-0 truncate text-rt-text">
                  {kind === 'series' ? `${i + 1}. ` : ''}No. {m.number != null ? String(m.number).padStart(3, '0') : '—'} · {m.title}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {kind === 'series' ? (
                    <>
                      <button type="button" onClick={() => move(i, -1)} className="text-rt-muted hover:text-rt-blue">↑</button>
                      <button type="button" onClick={() => move(i, 1)} className="text-rt-muted hover:text-rt-blue">↓</button>
                    </>
                  ) : null}
                  <button type="button" onClick={() => setMembers((prev) => prev.filter((_, j) => j !== i))} className="text-rt-error hover:underline">Remove</button>
                </span>
              </li>
            ))}
          </ol>
        )}
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save collection'}</Button>
        <button type="button" onClick={remove} className="text-sm text-rt-error hover:underline">Delete</button>
      </div>
    </div>
  );
}
