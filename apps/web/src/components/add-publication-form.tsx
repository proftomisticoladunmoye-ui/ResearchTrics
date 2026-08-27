'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Field, Alert } from '@researchtrics/ui';

interface CoAuthor {
  name: string;
  orcid: string;
  /** Set when linked to a ResearchTrics profile — the work then counts for them. */
  researcherId?: string | null;
}

interface Suggestion {
  id: string;
  displayName: string;
  academicRank: string | null;
  country: string | null;
}

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
  const [coAuthors, setCoAuthors] = useState<CoAuthor[]>([]);

  const addCoAuthor = () => setCoAuthors((cs) => [...cs, { name: '', orcid: '', researcherId: null }]);
  const updateCoAuthor = (i: number, patch: Partial<CoAuthor>) =>
    setCoAuthors((cs) => cs.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
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
          setMessage(
            `Couldn't upload the attached file — ${upBody.error?.message ?? 'the file service is unavailable.'} You can still add the publication without a file.`,
          );
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
        .map((c) => ({ name: c.name.trim(), orcid: c.orcid.trim(), researcherId: c.researcherId ?? null }))
        .filter((c) => c.name.length > 0)
        .map((c) => ({
          name: c.name,
          ...(c.orcid ? { orcid: c.orcid } : {}),
          ...(c.researcherId ? { researcherId: c.researcherId } : {}),
        }));
      if (cleanCoAuthors.length) payload.coAuthors = cleanCoAuthors;

      const res = await fetch('/api/v1/publications/manual', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => ({}))) as { data?: { slug: string }; error?: { message?: string } };
      if (!res.ok || !body.data) {
        setStatus('error');
        setMessage(`Couldn't save the publication — ${body.error?.message ?? 'please try again.'}`);
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

      {/* Co-authors — so you aren't shown as the sole author, and so the work
          counts on your co-authors' profiles too. */}
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-rt-text">Co-authors</span>
        <span className="-mt-1 text-xs text-rt-muted">
          Add everyone who authored this work. Search to link a co-author who is on ResearchTrics —
          the publication then counts on their profile too, and they’re notified. An ORCID also links
          them; a plain name is stored for off-platform authors.
        </span>
        {coAuthors.map((c, i) => (
          <CoAuthorRow
            key={i}
            index={i}
            value={c}
            onChange={(patch) => updateCoAuthor(i, patch)}
            onRemove={() => removeCoAuthor(i)}
          />
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

/**
 * One co-author input row with a platform typeahead. Typing a name searches
 * ResearchTrics profiles; selecting one links the co-author (captures their
 * researcherId) so the work counts for them. Selection can be cleared to revert
 * to a plain off-platform name.
 */
function CoAuthorRow({
  index,
  value,
  onChange,
  onRemove,
}: {
  index: number;
  value: CoAuthor;
  onChange: (patch: Partial<CoAuthor>) => void;
  onRemove: () => void;
}) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const linked = !!value.researcherId;
  const boxRef = useRef<HTMLDivElement>(null);

  // Debounced search — skip while a profile is already linked.
  useEffect(() => {
    if (linked) {
      setSuggestions([]);
      return;
    }
    const q = value.name.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/v1/researchers/search?q=${encodeURIComponent(q)}`, {
          signal: ctrl.signal,
        });
        if (!res.ok) return;
        const body = (await res.json()) as { data?: { items: Suggestion[] } };
        setSuggestions(body.data?.items ?? []);
        setOpen(true);
      } catch {
        /* aborted or offline — ignore */
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [value.name, linked]);

  // Close the dropdown on outside click.
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_170px_auto]">
      <div ref={boxRef} className="relative">
        <Input
          aria-label={`Co-author ${index + 1} name`}
          value={value.name}
          onChange={(e) => onChange({ name: e.target.value, researcherId: null })}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          maxLength={200}
          placeholder="Full name — search to link their profile"
          autoComplete="off"
        />
        {linked ? (
          <div className="mt-1 flex items-center gap-2 text-xs text-rt-blue">
            <span className="rounded bg-rt-blue-light px-1.5 py-0.5 font-medium">✓ Linked profile</span>
            <button
              type="button"
              onClick={() => onChange({ researcherId: null })}
              className="text-rt-muted hover:underline"
            >
              Unlink
            </button>
          </div>
        ) : null}
        {open && !linked && suggestions.length > 0 ? (
          <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-rt-border bg-rt-white shadow-lg">
            {suggestions.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange({ name: s.displayName, researcherId: s.id, orcid: '' });
                    setOpen(false);
                  }}
                  className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-rt-blue-light/30"
                >
                  <span className="font-medium text-rt-text">{s.displayName}</span>
                  {s.academicRank || s.country ? (
                    <span className="text-xs text-rt-muted">
                      {[s.academicRank, s.country].filter(Boolean).join(' · ')}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <Input
        aria-label={`Co-author ${index + 1} ORCID`}
        value={value.orcid}
        onChange={(e) => onChange({ orcid: e.target.value })}
        maxLength={40}
        placeholder="ORCID (optional)"
        disabled={linked}
      />
      <button
        type="button"
        onClick={onRemove}
        className="justify-self-start text-sm text-rt-error hover:underline"
      >
        Remove
      </button>
    </div>
  );
}
