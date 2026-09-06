'use client';

import { useState } from 'react';
import { Card, Input, Button, Alert } from '@researchtrics/ui';

export interface DiscussionComment {
  id: string;
  authorName: string;
  authorAffiliation: string | null;
  authorOrcid: string | null;
  body: string;
  createdAt: string; // ISO
}

const input = 'w-full rounded border border-rt-border bg-rt-white px-3 py-2 text-sm text-rt-text';

/**
 * Moderated scholarly discussion (§35): shows approved comments and a submission
 * form. Submissions are held for moderation — nothing appears until approved.
 */
export function BulletinDiscussion({ slug, approved }: { slug: string; approved: DiscussionComment[] }) {
  const [form, setForm] = useState({ authorName: '', authorEmail: '', authorAffiliation: '', authorOrcid: '', body: '' });
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const set = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }));

  async function submit() {
    setState('sending');
    setMessage(null);
    try {
      const res = await fetch(`/api/v1/research-bulletin/${slug}/comments`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
      });
      const body = (await res.json().catch(() => ({}))) as { data?: { message?: string }; error?: { message?: string } };
      if (!res.ok) { setState('error'); setMessage(body.error?.message ?? 'Could not submit your comment.'); return; }
      setState('done');
      setMessage(body.data?.message ?? 'Submitted for moderation.');
      setForm({ authorName: '', authorEmail: '', authorAffiliation: '', authorOrcid: '', body: '' });
    } catch {
      setState('error');
      setMessage('Network error. Please try again.');
    }
  }

  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold text-rt-text">Scholarly discussion</h2>
      <p className="mt-1 text-xs text-rt-muted">Comments are moderated and appear once approved. Be constructive and cite sources where relevant.</p>

      {approved.length > 0 ? (
        <ul className="mt-4 space-y-4">
          {approved.map((c) => (
            <li key={c.id} className="border-l-2 border-rt-border pl-3">
              <p className="text-sm font-medium text-rt-text">
                {c.authorName}
                {c.authorAffiliation ? <span className="font-normal text-rt-muted"> · {c.authorAffiliation}</span> : null}
                {c.authorOrcid ? (
                  <>
                    {' '}
                    <a className="text-xs text-rt-blue hover:underline" href={`https://orcid.org/${c.authorOrcid}`} target="_blank" rel="noopener noreferrer">ORCID</a>
                  </>
                ) : null}
              </p>
              <p className="mt-1 whitespace-pre-line text-sm text-rt-text">{c.body}</p>
              <p className="mt-1 text-xs text-rt-muted">{new Date(c.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-rt-muted">No comments yet. Start the discussion below.</p>
      )}

      <Card className="mt-6 p-5">
        <h3 className="text-sm font-semibold text-rt-text">Add a comment</h3>
        {state === 'done' ? (
          <Alert variant="success" className="mt-3">{message}</Alert>
        ) : (
          <div className="mt-3 space-y-3">
            {state === 'error' && message ? <Alert variant="error">{message}</Alert> : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <Input aria-label="Your name" placeholder="Your name" value={form.authorName} onChange={(e) => set('authorName', e.target.value)} />
              <Input aria-label="Email (not published)" type="email" placeholder="Email (not published)" value={form.authorEmail} onChange={(e) => set('authorEmail', e.target.value)} />
              <Input aria-label="Affiliation (optional)" placeholder="Affiliation (optional)" value={form.authorAffiliation} onChange={(e) => set('authorAffiliation', e.target.value)} />
              <Input aria-label="ORCID (optional)" placeholder="ORCID (optional)" value={form.authorOrcid} onChange={(e) => set('authorOrcid', e.target.value)} />
            </div>
            <textarea aria-label="Comment" rows={4} className={input} placeholder="Your comment…" value={form.body} onChange={(e) => set('body', e.target.value)} />
            <div className="flex items-center gap-3">
              <Button onClick={submit} size="sm" disabled={state === 'sending'}>{state === 'sending' ? 'Submitting…' : 'Submit for moderation'}</Button>
              <span className="text-xs text-rt-muted">Your email is used only for moderation and is never published.</span>
            </div>
          </div>
        )}
      </Card>
    </section>
  );
}
