'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Alert, Card } from '@researchtrics/ui';

interface CiteResult { number: number | null; slug: string; title: string; year: number | null; authors: string[] }

const TYPES: Array<{ value: string; label: string }> = [
  { value: 'research', label: 'Research Bulletin' },
  { value: 'methodological', label: 'Methodological Bulletin' },
  { value: 'psychometric', label: 'Psychometric Bulletin' },
  { value: 'statistical', label: 'Statistical Bulletin' },
  { value: 'ai_research', label: 'AI & Research Bulletin' },
  { value: 'research_technology', label: 'Research Technology Bulletin' },
  { value: 'conceptual', label: 'Conceptual Bulletin' },
  { value: 'evidence', label: 'Evidence Bulletin' },
  { value: 'research_practice', label: 'Research Practice Bulletin' },
  { value: 'policy_research', label: 'Policy Research Bulletin' },
  { value: 'replication', label: 'Replication Bulletin' },
  { value: 'commentary', label: 'Research Commentary' },
  { value: 'data_analysis', label: 'Data/Analysis Bulletin' },
];

const LICENSES: Array<{ value: string; label: string }> = [
  { value: 'all_rights_reserved', label: 'All rights reserved' },
  { value: 'cc_by', label: 'CC BY 4.0' },
  { value: 'cc_by_nc', label: 'CC BY-NC 4.0' },
  { value: 'cc_by_nc_sa', label: 'CC BY-NC-SA 4.0' },
];

interface Author { name: string; affiliation: string; orcid: string }
interface Ref { raw: string; doi: string }

export interface BulletinInitial {
  id?: string;
  number?: number | null;
  slug?: string;
  status?: string;
  title: string;
  subtitle: string;
  type: string;
  category: string;
  abstract: string;
  keywords: string;
  bodyHtml: string;
  license: string;
  featuredImage: string;
  authors: Author[];
  references: Ref[];
}

const EMPTY: BulletinInitial = {
  title: '', subtitle: '', type: 'research', category: '', abstract: '', keywords: '',
  bodyHtml: '', license: 'all_rights_reserved', featuredImage: '', authors: [{ name: '', affiliation: '', orcid: '' }], references: [],
};

const input = 'w-full rounded border border-rt-border bg-rt-white px-3 py-2 text-sm text-rt-text';

export function BulletinEditor({ initial }: { initial?: BulletinInitial }) {
  const router = useRouter();
  const [f, setF] = useState<BulletinInitial>(initial ?? EMPTY);
  const [id, setId] = useState<string | undefined>(initial?.id);
  const [status, setStatus] = useState<string>(initial?.status ?? 'draft');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);
  const [importing, setImporting] = useState(false);
  const [report, setReport] = useState<Record<string, unknown> | null>(null);
  const [citeQ, setCiteQ] = useState('');
  const [citeResults, setCiteResults] = useState<CiteResult[]>([]);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const set = (patch: Partial<BulletinInitial>) => setF((prev) => ({ ...prev, ...patch }));

  // Debounced search of published bulletins for the internal citation picker.
  useEffect(() => {
    const q = citeQ.trim();
    if (q.length < 2) { setCiteResults([]); return; }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/v1/research-bulletin/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        if (!res.ok) return;
        const body = (await res.json()) as { data?: { items: CiteResult[] } };
        setCiteResults(body.data?.items ?? []);
      } catch { /* aborted */ }
    }, 250);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [citeQ]);

  function insertCitation(r: CiteResult) {
    const first = r.authors[0] ?? 'ResearchTrics';
    const family = first.includes(',') ? first.split(',')[0]!.trim() : first.split(/\s+/).pop() ?? first;
    const yr = r.year ?? 'n.d.';
    const no = r.number != null ? String(r.number).padStart(3, '0') : '';
    const link = `<a href="/research-bulletin/${r.slug}">${family} (${yr}). ${r.title}. ResearchTrics Research Bulletin, ${no}.</a>`;
    const ta = bodyRef.current;
    const pos = ta ? ta.selectionStart : f.bodyHtml.length;
    const next = f.bodyHtml.slice(0, pos) + link + f.bodyHtml.slice(pos);
    set({ bodyHtml: next });
    setCiteQ('');
    setCiteResults([]);
  }

  async function importDocx(file: File) {
    setImporting(true);
    setMsg(null);
    setReport(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/v1/admin/research-bulletin/import', { method: 'POST', body: fd });
      const body = (await res.json().catch(() => ({}))) as {
        data?: { title: string; bodyHtml: string; report: Record<string, unknown> };
        error?: { message?: string };
      };
      if (!res.ok || !body.data) {
        setMsg({ kind: 'error', text: body.error?.message ?? 'Import failed.' });
        return;
      }
      set({ ...(body.data.title ? { title: body.data.title } : {}), bodyHtml: body.data.bodyHtml });
      setReport(body.data.report);
      setMsg({ kind: 'success', text: 'Word document imported. Review the report and edit before publishing.' });
    } catch {
      setMsg({ kind: 'error', text: 'Network error during import.' });
    } finally {
      setImporting(false);
    }
  }

  function payload() {
    return {
      title: f.title,
      subtitle: f.subtitle || null,
      type: f.type,
      category: f.category,
      abstract: f.abstract,
      keywords: f.keywords.split(',').map((k) => k.trim()).filter(Boolean),
      bodyHtml: f.bodyHtml,
      license: f.license,
      featuredImage: f.featuredImage || null,
      authors: f.authors.filter((a) => a.name.trim()).map((a, i) => ({ name: a.name.trim(), affiliation: a.affiliation.trim() || undefined, orcid: a.orcid.trim() || undefined, order: i })),
      references: f.references.filter((r) => r.raw.trim()).map((r) => ({ raw: r.raw.trim(), doi: r.doi.trim() || undefined })),
    };
  }

  async function save(): Promise<string | null> {
    setBusy(true);
    setMsg(null);
    try {
      const url = id ? `/api/v1/admin/research-bulletin/${id}` : '/api/v1/admin/research-bulletin';
      const method = id ? 'PATCH' : 'POST';
      const res = await fetch(url, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload()) });
      const body = (await res.json().catch(() => ({}))) as { data?: { id: string }; error?: { message?: string } };
      if (!res.ok) {
        setMsg({ kind: 'error', text: body.error?.message ?? 'Could not save.' });
        return null;
      }
      const savedId = id ?? body.data?.id;
      if (savedId && !id) setId(savedId);
      setMsg({ kind: 'success', text: 'Saved.' });
      return savedId ?? null;
    } catch {
      setMsg({ kind: 'error', text: 'Network error.' });
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    const savedId = await save();
    if (!savedId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/admin/research-bulletin/${savedId}`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'publish' }),
      });
      const body = (await res.json().catch(() => ({}))) as { data?: { number: number; slug: string }; error?: { message?: string } };
      if (!res.ok) {
        setMsg({ kind: 'error', text: body.error?.message ?? 'Could not publish.' });
        return;
      }
      setStatus('published');
      setMsg({ kind: 'success', text: `Published as No. ${String(body.data?.number).padStart(3, '0')}.` });
      if (body.data?.slug) router.push(`/research-bulletin/${body.data.slug}`);
    } catch {
      setMsg({ kind: 'error', text: 'Network error.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {msg ? <Alert variant={msg.kind === 'error' ? 'error' : 'success'}>{msg.text}</Alert> : null}

      <Card className="space-y-2 border-rt-blue/30 bg-rt-blue-light/10 p-5">
        <span className="text-sm font-semibold text-rt-text">Import from Microsoft Word (.docx)</span>
        <p className="text-xs text-rt-muted">
          Prepared the bulletin in Word? Upload it — headings, paragraphs, tables, images, links and YouTube
          embeds become editable content. Review the import report, then edit before publishing.
        </p>
        <input
          type="file"
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          disabled={importing}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void importDocx(file);
          }}
          className={input}
        />
        {importing ? <p className="text-xs text-rt-muted">Importing…</p> : null}
        {report ? (
          <div className="mt-1 rounded border border-rt-border bg-rt-white p-3 text-xs text-rt-text">
            <p className="font-semibold">Import report</p>
            <ul className="mt-1 space-y-0.5">
              <li>{report.titleDetected ? '✓' : '⚠'} Title {report.titleDetected ? 'detected' : 'not detected — set it manually'}</li>
              <li>✓ {String(report.headings)} headings · {String(report.paragraphs)} paragraphs</li>
              <li>✓ {String(report.tables)} tables · {String(report.images)} images ({String(report.imagesUploaded)} uploaded, {String(report.imagesInlined)} inlined)</li>
              <li>✓ {String(report.links)} links · {String(report.youtube)} YouTube embeds · {String(report.references)} references detected</li>
            </ul>
            {Array.isArray(report.warnings) && report.warnings.length > 0 ? (
              <ul className="mt-2 space-y-0.5 text-rt-error">
                {(report.warnings as string[]).map((w, i) => <li key={i}>⚠ {w}</li>)}
              </ul>
            ) : null}
          </div>
        ) : null}
      </Card>

      <Card className="space-y-3 p-5">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-rt-text">Title</span>
          <Input value={f.title} onChange={(e) => set({ title: e.target.value })} maxLength={300} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-rt-text">Subtitle (optional)</span>
          <Input value={f.subtitle} onChange={(e) => set({ subtitle: e.target.value })} maxLength={300} />
        </label>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-rt-text">Type</span>
            <select value={f.type} onChange={(e) => set({ type: e.target.value })} className={input}>
              {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-rt-text">Category</span>
            <Input value={f.category} onChange={(e) => set({ category: e.target.value })} placeholder="e.g. Psychometrics" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-rt-text">License</span>
            <select value={f.license} onChange={(e) => set({ license: e.target.value })} className={input}>
              {LICENSES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-rt-text">Keywords (comma-separated)</span>
          <Input value={f.keywords} onChange={(e) => set({ keywords: e.target.value })} placeholder="measurement invariance, CFA, DIF" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-rt-text">Featured image URL (optional)</span>
          <Input value={f.featuredImage} onChange={(e) => set({ featuredImage: e.target.value })} />
        </label>
      </Card>

      <Card className="space-y-3 p-5">
        <span className="text-sm font-semibold text-rt-text">Authors</span>
        {f.authors.map((a, i) => (
          <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_150px_auto]">
            <Input aria-label="Author name" value={a.name} placeholder="Full name" onChange={(e) => set({ authors: f.authors.map((x, j) => j === i ? { ...x, name: e.target.value } : x) })} />
            <Input aria-label="Affiliation" value={a.affiliation} placeholder="Affiliation" onChange={(e) => set({ authors: f.authors.map((x, j) => j === i ? { ...x, affiliation: e.target.value } : x) })} />
            <Input aria-label="ORCID" value={a.orcid} placeholder="ORCID" onChange={(e) => set({ authors: f.authors.map((x, j) => j === i ? { ...x, orcid: e.target.value } : x) })} />
            <button type="button" className="justify-self-start text-sm text-rt-error hover:underline" onClick={() => set({ authors: f.authors.filter((_, j) => j !== i) })}>Remove</button>
          </div>
        ))}
        <button type="button" className="text-sm font-medium text-rt-blue hover:underline" onClick={() => set({ authors: [...f.authors, { name: '', affiliation: '', orcid: '' }] })}>+ Add author</button>
      </Card>

      <Card className="space-y-3 p-5">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-rt-text">Abstract</span>
          <textarea value={f.abstract} onChange={(e) => set({ abstract: e.target.value })} rows={5} maxLength={5000} className={input} />
        </label>
        {/* Internal citation picker — cite another bulletin, inserted at the cursor */}
        <div className="rounded border border-rt-border bg-rt-blue-light/10 p-3">
          <span className="text-xs font-semibold text-rt-text">Cite another Research Bulletin</span>
          <Input value={citeQ} onChange={(e) => setCiteQ(e.target.value)} placeholder="Search published bulletins to insert an internal citation…" className="mt-1" />
          {citeResults.length > 0 ? (
            <ul className="mt-1 max-h-48 overflow-auto rounded border border-rt-border bg-rt-white">
              {citeResults.map((r) => (
                <li key={r.slug}>
                  <button type="button" onClick={() => insertCitation(r)} className="block w-full px-3 py-2 text-left text-xs hover:bg-rt-blue-light/30">
                    <span className="font-mono text-rt-muted">No. {r.number != null ? String(r.number).padStart(3, '0') : '—'}</span>{' '}
                    <span className="font-medium text-rt-text">{r.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-rt-text">Body (semantic HTML — headings, paragraphs, tables, figures, YouTube embeds)</span>
          <textarea ref={bodyRef} value={f.bodyHtml} onChange={(e) => set({ bodyHtml: e.target.value })} rows={18} className={`${input} font-mono text-xs`} placeholder="<h2>Introduction</h2>\n<p>…</p>" />
          <span className="mt-1 block text-xs text-rt-muted">HTML is sanitized on save. Allowed: headings, lists, tables, figures/captions, blockquotes, images, code, and YouTube/Vimeo embeds.</span>
        </label>
      </Card>

      <Card className="space-y-3 p-5">
        <span className="text-sm font-semibold text-rt-text">References</span>
        {f.references.map((r, i) => (
          <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_170px_auto]">
            <Input aria-label="Reference" value={r.raw} placeholder="Full reference text (APA)" onChange={(e) => set({ references: f.references.map((x, j) => j === i ? { ...x, raw: e.target.value } : x) })} />
            <Input aria-label="DOI" value={r.doi} placeholder="DOI (optional)" onChange={(e) => set({ references: f.references.map((x, j) => j === i ? { ...x, doi: e.target.value } : x) })} />
            <button type="button" className="justify-self-start text-sm text-rt-error hover:underline" onClick={() => set({ references: f.references.filter((_, j) => j !== i) })}>Remove</button>
          </div>
        ))}
        <button type="button" className="text-sm font-medium text-rt-blue hover:underline" onClick={() => set({ references: [...f.references, { raw: '', doi: '' }] })}>+ Add reference</button>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={save} disabled={busy}>{busy ? 'Working…' : id ? 'Save changes' : 'Create draft'}</Button>
        <Button onClick={publish} disabled={busy} variant="accent">Publish</Button>
        {id && status === 'published' ? <span className="text-xs text-rt-success">Published{f.number != null ? ` · No. ${String(f.number).padStart(3, '0')}` : ''}</span> : <span className="text-xs text-rt-muted">Status: {status}</span>}
      </div>
    </div>
  );
}
