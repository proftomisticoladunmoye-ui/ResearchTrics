'use client';

import { useState } from 'react';
import { Card, Button, Badge, Alert } from '@researchtrics/ui';

/** One writing tool the assistant offers. */
interface Tool {
  task: string;
  label: string;
  blurb: string;
  placeholder: string;
}

const TOOLS: Tool[] = [
  {
    task: 'abstract',
    label: 'Draft an abstract',
    blurb: 'From your title and key points — structured, 150–250 words.',
    placeholder:
      'Title: Reading intervention in rural primary schools\n\nKey points:\n- randomised across 12 schools\n- measured fluency at 6 months\n- (add your main finding)',
  },
  {
    task: 'title',
    label: 'Suggest titles',
    blurb: 'Five publishable title options from your abstract.',
    placeholder: 'Paste your abstract or a paragraph describing the study…',
  },
  {
    task: 'improve',
    label: 'Improve writing',
    blurb: 'Clearer, tighter academic English — no new claims added.',
    placeholder: 'Paste the paragraph you want to tighten…',
  },
  {
    task: 'questions',
    label: 'Research questions',
    blurb: 'Questions, gaps, and hypotheses to pursue in your area.',
    placeholder: 'Describe your topic, field, or the gap you are exploring…',
  },
  {
    task: 'keywords',
    label: 'Keywords',
    blurb: 'Indexing keywords + classifications for discoverability.',
    placeholder: 'Paste your title and abstract…',
  },
  {
    task: 'summary',
    label: 'Plain-language summary',
    blurb: 'A lay summary of your work for a general audience.',
    placeholder: 'Paste your abstract or key results…',
  },
];

interface AssistantResult {
  text: string;
  model: string;
  external: boolean;
  offline: boolean;
  disclaimer: string;
}

export function AssistantConsole() {
  const [task, setTask] = useState<string>('abstract');
  const [material, setMaterial] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AssistantResult | null>(null);
  const [copied, setCopied] = useState(false);

  const active = TOOLS.find((t) => t.task === task)!;

  async function run() {
    setLoading(true);
    setError(null);
    setResult(null);
    setCopied(false);
    try {
      const res = await fetch('/api/v1/assistant', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ task, material }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? 'Something went wrong. Please try again.');
      } else {
        setResult(json.data as AssistantResult);
      }
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
      <div className="flex flex-wrap gap-2">
        {TOOLS.map((t) => (
          <button
            key={t.task}
            type="button"
            onClick={() => {
              setTask(t.task);
              setResult(null);
              setError(null);
            }}
            aria-pressed={t.task === task}
            className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
              t.task === task
                ? 'border-rt-blue bg-rt-blue text-rt-white'
                : 'border-rt-border text-rt-text hover:bg-rt-blue-light'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <p className="mt-3 text-sm text-rt-muted">{active.blurb}</p>

      <textarea
        value={material}
        onChange={(e) => setMaterial(e.target.value)}
        placeholder={active.placeholder}
        rows={8}
        className="mt-3 w-full resize-y rounded-lg border border-rt-border bg-rt-white p-3 text-sm text-rt-text focus:border-rt-blue focus:outline-none focus:ring-1 focus:ring-rt-blue"
      />

      <div className="mt-3 flex items-center gap-3">
        <Button onClick={run} disabled={loading || material.trim().length < 8} size="sm">
          {loading ? 'Working…' : active.label}
        </Button>
        <span className="text-xs text-rt-muted">{material.trim().length} characters</span>
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
              <Badge variant="outline">
                {result.offline ? 'on-platform' : result.external ? 'Claude' : 'on-platform'}
              </Badge>
            </div>
            <Button onClick={copy} size="sm" variant="ghost">
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
          <div className="mt-3 whitespace-pre-wrap rounded-lg border border-rt-border bg-rt-blue-light/30 p-4 text-sm leading-relaxed text-rt-text">
            {result.text || 'No output — try adding more detail.'}
          </div>
          {result.offline ? (
            <p className="mt-2 text-xs text-rt-muted">
              This is the on-platform scaffold. Ask an administrator to enable the full AI provider
              for complete drafting.
            </p>
          ) : null}
          <p className="mt-3 text-xs text-rt-muted">{result.disclaimer}</p>
        </div>
      ) : null}
    </Card>
  );
}
