'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Field, Alert } from '@researchtrics/ui';

const OUTPUT_TYPES: Array<{ value: string; label: string }> = [
  { value: 'journal_article', label: 'Journal article' },
  { value: 'conference_paper', label: 'Conference paper' },
  { value: 'book', label: 'Book' },
  { value: 'book_chapter', label: 'Book chapter' },
  { value: 'thesis', label: 'Thesis' },
  { value: 'dissertation', label: 'Dissertation' },
  { value: 'preprint', label: 'Preprint' },
  { value: 'technical_report', label: 'Technical report' },
  { value: 'research_report', label: 'Research report' },
  { value: 'poster', label: 'Poster' },
  { value: 'presentation', label: 'Presentation' },
  { value: 'policy_brief', label: 'Policy brief' },
  { value: 'systematic_review', label: 'Systematic review' },
  { value: 'other', label: 'Other' },
];

/** Add a publication by hand — for outputs without a DOI (books, talks, reports). */
export function AddPublicationForm() {
  const router = useRouter();
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [coAuthors, setCoAuthors] = useState<Array<{ name: string; orcid: string }>>([]);

  const addCoAuthor = () => setCoAuthors((cs) => [...cs, { name: '', orcid: '' }]);
  const updateCoAuthor = (i: number, key: 'name' | 'orcid', value: string) =>
    setCoAuthors((cs) => cs.map((c, idx) => (idx === i ? { ...c, [key]: value } : c)));
  const removeCoAuthor = (i: number) => setCoAuthors((cs) => cs.filter((_, idx) => idx !== i));

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const title = String(fd.get('title') ?? '').trim();
    if (title.length < 3) {
      setStatus('error');
      setMessage('A title of at least 3 characters is required.');
      return;
    }
    setStatus('saving');
    setMessage(null);

    try {
      // Optionally upload an attached file first, then reference it.
      let primaryFileId: string | undefined;
      const file = fd.get('file');
      if (file instanceof File && file.size > 0) {
        const upFd = new FormData();
        upFd.append('file', file);
        upFd.append('accessLevel', 'public');
        const up = await fetch('/api/v1/files', { method: 'POST', body: upFd });
        const upBody = (await up.json().catch(() => ({}))) as { data?: { id: string }; error?: { message?: string } };
        if (!up.ok || !upBody.data) {
          setStatus('error');
          setMessage(upBody.error?.message ?? 'File upload failed.');
          return;
        }
        primaryFileId = upBody.data.id;
      }

      const yearRaw = String(fd.get('publishedYear') ?? '').trim();
      const payload: Record<string, unknown> = {
        title,
        outputType: fd.get('outputType') || undefined,
        venue: fd.get('venue') || undefined,
        publisher: fd.get('publisher') || undefined,
        abstract: fd.get('abstract') || undefined,
        ...(yearRaw ? { publishedYear: Number(yearRaw) } : {}),
        ...(primaryFileId ? { primaryFileId } : {}),
      };

      const cleanCoAuthors = coAuthors
        .map((c) => ({ name: c.name.trim(), orcid: c.orcid.trim() }))
        .filter((c) => c.name.length > 0)
        .map((c) => ({ name: c.name, ...(c.orcid ? { orcid: c.orcid } : {}) }));
      if (cleanCoAuthors.length) payload.coAuthors = cleanCoAuthors;

      const res = await fetch('/api/v1/publications/manual', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => ({}))) as { data?: { slug: string }; error?: { message?: string } };
      if (!res.ok || !body.data) {
        setStatus('error');
        setMessage(body.error?.message ?? 'Could not add publication.');
        return;
      }
      form.reset();
      setCoAuthors([]);
      setStatus('idle');
      router.refresh();
    } catch {
      setStatus('error');
      setMessage('Network error.');
    }
  }

  const inputClass = 'w-full rounded border border-rt-border bg-rt-white px-3 py-2 text-sm text-rt-text';

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Field label="Title" htmlFor="title">
        <Input id="title" name="title" required maxLength={500} placeholder="Title of the work" />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Type" htmlFor="outputType">
          <select id="outputType" name="outputType" className={inputClass} defaultValue="journal_article">
            {OUTPUT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Year" htmlFor="publishedYear">
          <Input id="publishedYear" name="publishedYear" type="number" min={1500} max={2100} placeholder="2026" />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Venue (journal / conference)" htmlFor="venue">
          <Input id="venue" name="venue" maxLength={300} />
        </Field>
        <Field label="Publisher" htmlFor="publisher">
          <Input id="publisher" name="publisher" maxLength={300} />
        </Field>
      </div>
      <Field label="Abstract" htmlFor="abstract">
        <textarea id="abstract" name="abstract" rows={3} maxLength={10000} className={inputClass} />
      </Field>

      {/* Co-authors — so you aren't shown as the sole author */}
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-rt-text">Co-authors</span>
        <span className="-mt-1 text-xs text-rt-muted">
          Add everyone who authored this work. An ORCID links a co-author to their ResearchTrics profile.
        </span>
        {coAuthors.map((c, i) => (
          <div key={i} className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_170px_auto]">
            <Input
              aria-label={`Co-author ${i + 1} name`}
              value={c.name}
              onChange={(e) => updateCoAuthor(i, 'name', e.target.value)}
              maxLength={200}
              placeholder="Full name"
            />
            <Input
              aria-label={`Co-author ${i + 1} ORCID`}
              value={c.orcid}
              onChange={(e) => updateCoAuthor(i, 'orcid', e.target.value)}
              maxLength={40}
              placeholder="ORCID (optional)"
            />
            <button
              type="button"
              onClick={() => removeCoAuthor(i)}
              className="justify-self-start text-sm text-rt-error hover:underline"
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addCoAuthor}
          className="mt-1 self-start text-sm font-medium text-rt-blue hover:underline"
        >
          + Add co-author
        </button>
      </div>

      <Field label="Attach a file (optional)" htmlFor="file">
        <input
          id="file"
          name="file"
          type="file"
          accept="application/pdf,image/png,image/jpeg"
          className={inputClass}
        />
      </Field>
      <Button type="submit" disabled={status === 'saving'}>
        {status === 'saving' ? 'Adding…' : 'Add publication'}
      </Button>
      {message ? <Alert variant="error">{message}</Alert> : null}
    </form>
  );
}
