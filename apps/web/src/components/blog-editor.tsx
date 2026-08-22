'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { ChangeEvent, ReactNode } from 'react';
import { Button, Input, Alert } from '@researchtrics/ui';

function Labeled({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-rt-text">{label}</span>
      {hint ? <span className="-mt-1 text-xs text-rt-muted">{hint}</span> : null}
      {children}
    </div>
  );
}

export interface EditablePost {
  id: string;
  title: string;
  excerpt: string;
  body: string;
  tone: string;
  coverImage: string | null;
  published: boolean;
}

const TONES: Array<{ value: string; label: string }> = [
  { value: 'blue', label: 'Blue' },
  { value: 'gold', label: 'Gold' },
  { value: 'green', label: 'Green' },
  { value: 'violet', label: 'Violet' },
];

/** Create/edit a blog post. Talks to /api/v1/admin/blog. */
export function BlogEditor({ post }: { post?: EditablePost }) {
  const router = useRouter();
  const editing = !!post;
  const [title, setTitle] = useState(post?.title ?? '');
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? '');
  const [body, setBody] = useState(post?.body ?? '');
  const [tone, setTone] = useState(post?.tone ?? 'blue');
  const [published, setPublished] = useState(post?.published ?? false);
  const [coverImage, setCoverImage] = useState<string | null>(post?.coverImage ?? null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onCover(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image (PNG or JPEG).');
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('accessLevel', 'public');
      const up = await fetch('/api/v1/files', { method: 'POST', body: fd });
      const body = (await up.json().catch(() => ({}))) as { data?: { url: string } };
      if (!up.ok || !body.data) {
        setError('Cover upload failed.');
        return;
      }
      setCoverImage(body.data.url);
    } catch {
      setError('Network error during upload.');
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const url = editing ? `/api/v1/admin/blog/${post!.id}` : '/api/v1/admin/blog';
      const res = await fetch(url, {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title, excerpt, body, tone, published, coverImage }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error?.message ?? 'Could not save the post.');
        return;
      }
      router.push('/admin/blog');
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!editing || !confirm('Delete this post permanently?')) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/admin/blog/${post!.id}`, { method: 'DELETE' });
      if (!res.ok) {
        setError('Could not delete the post.');
        return;
      }
      router.push('/admin/blog');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Labeled label="Title">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Post title" />
      </Labeled>

      <Labeled label="Excerpt" hint="One or two sentences shown on cards and in search.">
        <textarea
          value={excerpt}
          onChange={(e) => setExcerpt(e.target.value)}
          rows={2}
          className="w-full resize-y rounded-lg border border-rt-border bg-rt-white p-3 text-sm text-rt-text focus:border-rt-blue focus:outline-none focus:ring-1 focus:ring-rt-blue"
        />
      </Labeled>

      <Labeled label="Body" hint="Separate paragraphs with a blank line.">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={14}
          className="w-full resize-y rounded-lg border border-rt-border bg-rt-white p-3 text-sm leading-relaxed text-rt-text focus:border-rt-blue focus:outline-none focus:ring-1 focus:ring-rt-blue"
        />
      </Labeled>

      <Labeled label="Cover image" hint="A display picture for the post. If none, a coloured cover is used.">
        <div className="flex flex-wrap items-center gap-4">
          {coverImage ? (
            <img src={coverImage} alt="Cover preview" className="h-20 w-32 rounded object-cover" />
          ) : (
            <div className="flex h-20 w-32 items-center justify-center rounded bg-gradient-to-br from-rt-blue to-rt-blue-dark text-xs text-rt-white/90">
              No image
            </div>
          )}
          <div>
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onCover} className="text-sm" />
            <p className="mt-1 text-xs text-rt-muted">{uploading ? 'Uploading…' : 'PNG, JPEG, or WebP.'}</p>
            {coverImage ? (
              <button type="button" onClick={() => setCoverImage(null)} className="mt-1 text-xs text-rt-error hover:underline">
                Remove image
              </button>
            ) : null}
          </div>
        </div>
      </Labeled>

      <div className="flex flex-wrap items-center gap-4">
        <Labeled label="Cover colour" hint="Used when there is no cover image.">
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            className="rounded-lg border border-rt-border bg-rt-white p-2 text-sm text-rt-text"
          >
            {TONES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </Labeled>
        <label className="mt-6 flex items-center gap-2 text-sm text-rt-text">
          <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
          Published (visible to everyone)
        </label>
      </div>

      {error ? <Alert variant="error">{error}</Alert> : null}

      <div className="flex items-center gap-3 pt-2">
        <Button onClick={save} disabled={busy}>
          {busy ? 'Saving…' : editing ? 'Save changes' : 'Create post'}
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/blog">Cancel</Link>
        </Button>
        {editing ? (
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="ml-auto text-sm font-medium text-rt-error hover:underline disabled:opacity-60"
          >
            Delete
          </button>
        ) : null}
      </div>
    </div>
  );
}
