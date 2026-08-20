'use client';

import { useMemo, useState } from 'react';
import { Card, Button, Badge, Alert, Input } from '@researchtrics/ui';

interface Tool {
  task: string;
  label: string;
  group: 'Write' | 'Polish' | 'Analyse';
  blurb: string;
  placeholder: string;
  /** Web browsing offered (research-oriented tools). */
  web?: boolean;
  /** Length control is meaningful for this tool. */
  sized?: boolean;
}

const TOOLS: Tool[] = [
  {
    task: 'journal_article',
    label: 'Journal article — full draft',
    group: 'Write',
    web: true,
    sized: true,
    blurb: 'A complete IMRaD first draft from your brief. Turn on web browsing for real citations.',
    placeholder:
      'Describe your study: topic, aim, method, and your main finding(s).\n\ne.g. A randomised trial of a numeracy intervention in 12 rural primary schools; measured comprehension at 6 months; main finding: a 14% gain over control.',
  },
  {
    task: 'grant',
    label: 'Grant proposal — draft',
    group: 'Write',
    web: true,
    sized: true,
    blurb: 'A structured proposal: significance, aims, approach, impact, timeline.',
    placeholder: 'Describe the project: problem, aim, approach, and expected impact…',
  },
  {
    task: 'abstract',
    label: 'Abstract',
    group: 'Write',
    web: true,
    sized: true,
    blurb: 'A structured abstract (150–250 words) from your title and key points.',
    placeholder: 'Title + key points, one per line…',
  },
  {
    task: 'outline',
    label: 'Paper outline',
    group: 'Write',
    web: true,
    blurb: 'An IMRaD outline with what to cover under each heading.',
    placeholder: 'Describe the work you want to structure…',
  },
  {
    task: 'cover_letter',
    label: 'Cover letter to editor',
    group: 'Write',
    blurb: 'A concise, professional submission letter.',
    placeholder: 'What the paper reports + the target journal…',
  },
  {
    task: 'reviewer_response',
    label: 'Response to reviewers',
    group: 'Write',
    sized: true,
    blurb: 'A courteous, point-by-point response.',
    placeholder: 'Paste the reviewer comments…',
  },
  {
    task: 'proofread',
    label: 'Proofread',
    group: 'Polish',
    blurb: 'Fix grammar, tense, and word choice without changing meaning.',
    placeholder: 'Paste the text to proofread…',
  },
  {
    task: 'translate',
    label: 'Translate & polish to English',
    group: 'Polish',
    blurb: 'Turn text in any language into publication-ready academic English.',
    placeholder: 'Paste your text (any language)…',
  },
  {
    task: 'improve',
    label: 'Improve writing',
    group: 'Polish',
    blurb: 'Clearer, tighter academic English — no new claims.',
    placeholder: 'Paste the paragraph to tighten…',
  },
  {
    task: 'paraphrase',
    label: 'Paraphrase',
    group: 'Polish',
    blurb: 'Reword while preserving the exact meaning.',
    placeholder: 'Paste the passage to reword…',
  },
  {
    task: 'critique',
    label: 'Feedback on my draft',
    group: 'Analyse',
    sized: true,
    blurb: 'Honest, actionable feedback — strengths and what to improve. It won’t rewrite it.',
    placeholder: 'Paste the draft you want feedback on…',
  },
  {
    task: 'title',
    label: 'Suggest titles',
    group: 'Analyse',
    blurb: 'Five publishable title options from your abstract.',
    placeholder: 'Paste your abstract or a summary…',
  },
  {
    task: 'keywords',
    label: 'Keywords',
    group: 'Analyse',
    blurb: 'Indexing keywords + classifications for discoverability.',
    placeholder: 'Paste your title and abstract…',
  },
  {
    task: 'summary',
    label: 'Plain-language summary',
    group: 'Analyse',
    web: true,
    blurb: 'A lay summary of your work for a general audience.',
    placeholder: 'Paste your abstract or key results…',
  },
  {
    task: 'questions',
    label: 'Research questions',
    group: 'Analyse',
    web: true,
    blurb: 'Questions, gaps, and hypotheses to pursue in your area.',
    placeholder: 'Describe your topic, field, or the gap you are exploring…',
  },
];

const GROUPS: Array<Tool['group']> = ['Write', 'Polish', 'Analyse'];

interface AssistantResult {
  text: string;
  model: string;
  external: boolean;
  offline: boolean;
  diagnostic?: string;
  disclaimer: string;
}

export function AssistantConsole({ webAllowed = true }: { webAllowed?: boolean }) {
  const [task, setTask] = useState<string>('journal_article');
  const [material, setMaterial] = useState('');
  const [web, setWeb] = useState(false);
  const [length, setLength] = useState<'brief' | 'standard' | 'detailed'>('standard');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AssistantResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [refineText, setRefineText] = useState('');
  const [refining, setRefining] = useState(false);

  const active = useMemo(() => TOOLS.find((t) => t.task === task)!, [task]);
  const canWeb = !!active.web && webAllowed;
  const webIsPremium = !!active.web && !webAllowed;
  const canSize = !!active.sized;

  async function post(body: Record<string, unknown>): Promise<AssistantResult | null> {
    const res = await fetch('/api/v1/assistant', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json?.error?.message ?? 'Something went wrong. Please try again.');
      return null;
    }
    return json.data as AssistantResult;
  }

  async function run() {
    setLoading(true);
    setError(null);
    setResult(null);
    setCopied(false);
    try {
      const data = await post({ task, material, web: canWeb && web, length: canSize ? length : undefined });
      if (data) setResult(data);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function refine() {
    if (!result || refineText.trim().length < 2) return;
    setRefining(true);
    setError(null);
    try {
      const data = await post({ task: 'refine', material: result.text, directive: refineText.trim(), length });
      if (data) {
        setResult(data);
        setRefineText('');
        setCopied(false);
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setRefining(false);
    }
  }

  async function copy() {
    if (!result) return;
    await navigator.clipboard.writeText(result.text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function download() {
    if (!result) return;
    const blob = new Blob([result.text], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${task}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <Card className="p-6">
      <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-rt-text">What do you want to do?</span>
          <select
            value={task}
            onChange={(e) => {
              setTask(e.target.value);
              setResult(null);
              setError(null);
            }}
            className="w-full rounded-lg border border-rt-border bg-rt-white p-2.5 text-sm text-rt-text focus:border-rt-blue focus:outline-none focus:ring-1 focus:ring-rt-blue"
          >
            {GROUPS.map((g) => (
              <optgroup key={g} label={g}>
                {TOOLS.filter((t) => t.group === g).map((t) => (
                  <option key={t.task} value={t.task}>{t.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>

        <div className="flex flex-wrap items-center gap-3">
          {canSize ? (
            <label className="flex items-center gap-2 text-sm text-rt-text">
              Length
              <select
                value={length}
                onChange={(e) => setLength(e.target.value as 'brief' | 'standard' | 'detailed')}
                className="rounded-lg border border-rt-border bg-rt-white p-2 text-sm text-rt-text"
              >
                <option value="brief">Brief</option>
                <option value="standard">Standard</option>
                <option value="detailed">Detailed</option>
              </select>
            </label>
          ) : null}
          {canWeb ? (
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-rt-border px-3 py-2 text-sm text-rt-text">
              <input type="checkbox" checked={web} onChange={(e) => setWeb(e.target.checked)} />
              🌐 Browse the web
            </label>
          ) : webIsPremium ? (
            <a
              href="/pricing"
              className="flex items-center gap-2 rounded-lg border border-rt-border px-3 py-2 text-sm text-rt-muted hover:text-rt-blue"
              title="Web browsing is a Premium feature"
            >
              🌐 Browse the web <span className="rounded bg-rt-gold-light px-1.5 text-xs text-rt-blue-dark">Premium</span>
            </a>
          ) : null}
        </div>
      </div>

      <p className="mt-2 text-sm text-rt-muted">{active.blurb}</p>

      <textarea
        value={material}
        onChange={(e) => setMaterial(e.target.value)}
        placeholder={active.placeholder}
        rows={task === 'journal_article' || task === 'grant' ? 7 : 6}
        className="mt-3 w-full resize-y rounded-lg border border-rt-border bg-rt-white p-3 text-sm leading-relaxed text-rt-text focus:border-rt-blue focus:outline-none focus:ring-1 focus:ring-rt-blue"
      />

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button onClick={run} disabled={loading || material.trim().length < 8} size="sm">
          {loading ? (canWeb && web ? 'Researching…' : 'Working…') : `Generate ${active.label.toLowerCase()}`}
        </Button>
        <span className="text-xs text-rt-muted">{material.trim().length} characters</span>
        {canWeb && web ? (
          <span className="text-xs text-rt-muted">Web browsing on — this takes longer and cites live sources.</span>
        ) : null}
      </div>

      {error ? (
        <Alert variant="error" className="mt-4">
          {error}
        </Alert>
      ) : null}

      {result ? (
        <div className="mt-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Badge variant="neutral">AI-generated</Badge>
              <Badge variant="outline">{result.offline || !result.external ? 'on-platform' : result.model}</Badge>
            </div>
            <div className="flex items-center gap-1">
              <Button onClick={download} size="sm" variant="ghost">Download</Button>
              <Button onClick={copy} size="sm" variant="ghost">{copied ? 'Copied' : 'Copy'}</Button>
            </div>
          </div>
          <div className="mt-3 max-h-[32rem] overflow-y-auto whitespace-pre-wrap rounded-lg border border-rt-border bg-rt-blue-light/20 p-4 text-sm leading-relaxed text-rt-text">
            {result.text || 'No output — try adding more detail.'}
          </div>

          {/* Refine the result in place */}
          {!result.offline ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Input
                value={refineText}
                onChange={(e) => setRefineText(e.target.value)}
                placeholder="Refine this — e.g. make it shorter, more formal, add a limitations paragraph…"
                className="min-w-0 flex-1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') refine();
                }}
              />
              <Button onClick={refine} size="sm" variant="secondary" disabled={refining || refineText.trim().length < 2}>
                {refining ? 'Refining…' : 'Refine'}
              </Button>
            </div>
          ) : (
            <div className="mt-2 text-xs text-rt-muted">
              <p>
                This is the on-platform scaffold. Ask an administrator to enable the full AI provider
                for complete drafting.
              </p>
              {result.diagnostic ? (
                <p className="mt-1 font-mono text-rt-error">Provider status: {result.diagnostic}</p>
              ) : null}
            </div>
          )}

          <p className="mt-3 text-xs text-rt-muted">{result.disclaimer}</p>
        </div>
      ) : null}
    </Card>
  );
}
