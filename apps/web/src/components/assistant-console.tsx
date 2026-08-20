'use client';

import { useMemo, useState } from 'react';
import { Card, Button, Badge, Alert } from '@researchtrics/ui';

/** One writing tool the assistant offers. */
interface Tool {
  task: string;
  label: string;
  group: 'Write' | 'Polish' | 'Discover';
  blurb: string;
  placeholder: string;
  /** Web browsing is offered for research-oriented tools only. */
  web?: boolean;
}

const TOOLS: Tool[] = [
  {
    task: 'journal_article',
    label: 'Journal article — full draft',
    group: 'Write',
    web: true,
    blurb: 'A complete IMRaD first draft from your brief. Turn on web browsing for real citations.',
    placeholder:
      'Describe your study: topic, aim, method, and your main finding(s).\n\ne.g. A randomised trial of a numeracy intervention in 12 rural primary schools; measured comprehension gains at 6 months; main finding: a 14% improvement over control.',
  },
  {
    task: 'abstract',
    label: 'Abstract',
    group: 'Write',
    web: true,
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
    task: 'title',
    label: 'Suggest titles',
    group: 'Discover',
    blurb: 'Five publishable title options from your abstract.',
    placeholder: 'Paste your abstract or a summary…',
  },
  {
    task: 'keywords',
    label: 'Keywords',
    group: 'Discover',
    blurb: 'Indexing keywords + classifications for discoverability.',
    placeholder: 'Paste your title and abstract…',
  },
  {
    task: 'summary',
    label: 'Plain-language summary',
    group: 'Discover',
    web: true,
    blurb: 'A lay summary of your work for a general audience.',
    placeholder: 'Paste your abstract or key results…',
  },
  {
    task: 'questions',
    label: 'Research questions',
    group: 'Discover',
    web: true,
    blurb: 'Questions, gaps, and hypotheses to pursue in your area.',
    placeholder: 'Describe your topic, field, or the gap you are exploring…',
  },
];

const GROUPS: Array<Tool['group']> = ['Write', 'Polish', 'Discover'];

interface AssistantResult {
  text: string;
  model: string;
  external: boolean;
  offline: boolean;
  diagnostic?: string;
  disclaimer: string;
}

export function AssistantConsole() {
  const [task, setTask] = useState<string>('journal_article');
  const [material, setMaterial] = useState('');
  const [web, setWeb] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AssistantResult | null>(null);
  const [copied, setCopied] = useState(false);

  const active = useMemo(() => TOOLS.find((t) => t.task === task)!, [task]);
  const canWeb = !!active.web;

  async function run() {
    setLoading(true);
    setError(null);
    setResult(null);
    setCopied(false);
    try {
      const res = await fetch('/api/v1/assistant', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ task, material, web: canWeb && web }),
      });
      const json = await res.json();
      if (!res.ok) setError(json?.error?.message ?? 'Something went wrong. Please try again.');
      else setResult(json.data as AssistantResult);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!result) return;
    await navigator.clipboard.writeText(result.text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Card className="p-6">
      {/* Tool + options row */}
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

        {canWeb ? (
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-rt-border px-3 py-2.5 text-sm text-rt-text">
            <input type="checkbox" checked={web} onChange={(e) => setWeb(e.target.checked)} />
            🌐 Browse the web
          </label>
        ) : null}
      </div>

      <p className="mt-2 text-sm text-rt-muted">{active.blurb}</p>

      <textarea
        value={material}
        onChange={(e) => setMaterial(e.target.value)}
        placeholder={active.placeholder}
        rows={task === 'journal_article' ? 7 : 6}
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
            <Button onClick={copy} size="sm" variant="ghost">
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
          <div className="mt-3 max-h-[32rem] overflow-y-auto whitespace-pre-wrap rounded-lg border border-rt-border bg-rt-blue-light/20 p-4 text-sm leading-relaxed text-rt-text">
            {result.text || 'No output — try adding more detail.'}
          </div>
          {result.offline ? (
            <div className="mt-2 text-xs text-rt-muted">
              <p>
                This is the on-platform scaffold. Ask an administrator to enable the full AI provider
                for complete drafting.
              </p>
              {result.diagnostic ? (
                <p className="mt-1 font-mono text-rt-error">Provider status: {result.diagnostic}</p>
              ) : null}
            </div>
          ) : null}
          <p className="mt-3 text-xs text-rt-muted">{result.disclaimer}</p>
        </div>
      ) : null}
    </Card>
  );
}
