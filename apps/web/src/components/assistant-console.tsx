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

interface ToolGroup {
  heading: string;
  tools: Tool[];
}

// Grouped like a research writing suite (Paperpal/Writefull-style), but grounded.
const GROUPS: ToolGroup[] = [
  {
    heading: 'Draft',
    tools: [
      {
        task: 'abstract',
        label: 'Abstract',
        blurb: 'A structured abstract (150–250 words) from your title and key points.',
        placeholder:
          'Title: Reading intervention in rural primary schools\n\nKey points:\n- randomised across 12 schools\n- measured fluency at 6 months\n- (add your main finding)',
      },
      {
        task: 'title',
        label: 'Titles',
        blurb: 'Five publishable title options from your abstract or summary.',
        placeholder: 'Paste your abstract or a paragraph describing the study…',
      },
      {
        task: 'outline',
        label: 'Paper outline',
        blurb: 'An IMRaD structure with what to cover in each section.',
        placeholder: 'Describe your study — aim, what you did, and what you found…',
      },
    ],
  },
  {
    heading: 'Language & clarity',
    tools: [
      {
        task: 'improve',
        label: 'Improve writing',
        blurb: 'Clearer, tighter academic English — structure and flow, no new claims.',
        placeholder: 'Paste the paragraph you want to strengthen…',
      },
      {
        task: 'proofread',
        label: 'Proofread',
        blurb: 'Fix grammar, spelling, and word choice — ideal for English as a second language.',
        placeholder: 'Paste text to correct — meaning and wording are preserved…',
      },
      {
        task: 'paraphrase',
        label: 'Paraphrase',
        blurb: 'Reword while keeping the exact meaning — improve originality and flow.',
        placeholder: 'Paste the passage to reword…',
      },
    ],
  },
  {
    heading: 'Submit & respond',
    tools: [
      {
        task: 'cover_letter',
        label: 'Cover letter',
        blurb: 'A journal submission cover letter to the editor.',
        placeholder: 'Title + a short abstract, and the target journal if known…',
      },
      {
        task: 'reviewer_response',
        label: 'Response to reviewers',
        blurb: 'A courteous, point-by-point reply to reviewer comments.',
        placeholder: 'Paste the reviewer comments (and, optionally, the changes you plan)…',
      },
    ],
  },
  {
    heading: 'Plan & discover',
    tools: [
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
    ],
  },
];

const ALL_TOOLS = GROUPS.flatMap((g) => g.tools);

// One-tap refinements applied to a result (global-standard iterate-on-output UX).
const QUICK_REFINEMENTS = ['Make it shorter', 'More formal', 'Simpler language', 'Expand slightly', 'Fix any grammar'];

interface AssistantResult {
  text: string;
  model: string;
  external: boolean;
  offline: boolean;
  disclaimer: string;
}

function wordCount(s: string): number {
  const t = s.trim();
  return t ? t.split(/\s+/).length : 0;
}

export function AssistantConsole() {
  const [task, setTask] = useState<string>('abstract');
  const [material, setMaterial] = useState('');
  const [loading, setLoading] = useState(false);
  const [refining, setRefining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AssistantResult | null>(null);
  const [customRefine, setCustomRefine] = useState('');
  const [copied, setCopied] = useState(false);

  const active = ALL_TOOLS.find((t) => t.task === task)!;

  async function call(body: Record<string, unknown>): Promise<AssistantResult | null> {
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
      const data = await call({ task, material });
      if (data) setResult(data);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function refine(directive: string) {
    if (!result) return;
    setRefining(true);
    setError(null);
    setCopied(false);
    try {
      const data = await call({ task: 'refine', material: result.text, directive });
      if (data) setResult(data);
      setCustomRefine('');
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

  const busy = loading || refining;

  return (
    <Card className="p-6">
      {/* Tool picker, grouped */}
      <div className="space-y-3">
        {GROUPS.map((g) => (
          <div key={g.heading}>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-rt-muted">{g.heading}</p>
            <div className="flex flex-wrap gap-2">
              {g.tools.map((t) => (
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
          </div>
        ))}
      </div>

      <p className="mt-4 text-sm text-rt-muted">{active.blurb}</p>

      <textarea
        value={material}
        onChange={(e) => setMaterial(e.target.value)}
        placeholder={active.placeholder}
        rows={8}
        className="mt-3 w-full resize-y rounded-lg border border-rt-border bg-rt-white p-3 text-sm text-rt-text focus:border-rt-blue focus:outline-none focus:ring-1 focus:ring-rt-blue"
      />

      <div className="mt-3 flex items-center gap-3">
        <Button onClick={run} disabled={busy || material.trim().length < 8} size="sm">
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
              <Badge variant="outline">{result.offline || !result.external ? 'on-platform' : result.model}</Badge>
              <span className="text-xs text-rt-muted">{wordCount(result.text)} words</span>
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
          ) : (
            /* Iterate on the output — the global-standard refine loop. */
            <div className="mt-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-rt-muted">Refine:</span>
                {QUICK_REFINEMENTS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => refine(r)}
                    disabled={busy}
                    className="rounded-full border border-rt-border px-2.5 py-1 text-xs text-rt-text hover:bg-rt-blue-light disabled:opacity-50"
                  >
                    {r}
                  </button>
                ))}
                {refining ? <span className="text-xs text-rt-muted">Refining…</span> : null}
              </div>
              <div className="mt-2 flex gap-2">
                <input
                  value={customRefine}
                  onChange={(e) => setCustomRefine(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && customRefine.trim().length >= 2 && !busy) refine(customRefine.trim());
                  }}
                  placeholder="Or type your own: e.g. “use British spelling”, “target 200 words”…"
                  className="flex-1 rounded-lg border border-rt-border bg-rt-white px-3 py-1.5 text-sm text-rt-text focus:border-rt-blue focus:outline-none focus:ring-1 focus:ring-rt-blue"
                />
                <Button
                  onClick={() => refine(customRefine.trim())}
                  disabled={busy || customRefine.trim().length < 2}
                  size="sm"
                  variant="secondary"
                >
                  Apply
                </Button>
              </div>
            </div>
          )}

          <p className="mt-3 text-xs text-rt-muted">{result.disclaimer}</p>
        </div>
      ) : null}
    </Card>
  );
}
