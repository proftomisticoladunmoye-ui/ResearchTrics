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

// The full toolset (the core supports all of these). Grouped so the surface
// reads clearly: compose, polish, and discover.
const GROUPS: ToolGroup[] = [
  {
    heading: 'Write',
    tools: [
      {
        task: 'abstract',
        label: 'Abstract',
        blurb: 'A structured abstract (150–250 words) from your title and key points.',
        placeholder:
          'Title: Reading intervention in rural primary schools\n\nKey points:\n- randomised across 12 schools\n- measured fluency at 6 months\n- (add your main finding)',
      },
      {
        task: 'outline',
        label: 'Paper outline',
        blurb: 'An IMRaD structure with prompts for each section.',
        placeholder: 'Describe your study — topic, what you did, and what you found…',
      },
      {
        task: 'cover_letter',
        label: 'Cover letter',
        blurb: 'A cover letter to the journal editor.',
        placeholder:
          'What the paper reports, the target journal, and why it fits. Use [JOURNAL]/[EDITOR] if unsure.',
      },
      {
        task: 'reviewer_response',
        label: 'Reviewer response',
        blurb: 'A courteous, point-by-point reply to reviewer comments.',
        placeholder: 'Paste the reviewer comments. Add your intended change after each if you have it…',
      },
    ],
  },
  {
    heading: 'Polish',
    tools: [
      {
        task: 'proofread',
        label: 'Proofread',
        blurb: 'Fix grammar, spelling, tense, and articles — ideal for writing in English as a second language.',
        placeholder: 'Paste the passage to proofread…',
      },
      {
        task: 'improve',
        label: 'Improve writing',
        blurb: 'Clearer, tighter, more formal academic English — no new claims added.',
        placeholder: 'Paste the paragraph you want to strengthen…',
      },
      {
        task: 'paraphrase',
        label: 'Paraphrase',
        blurb: 'Reword and restructure while keeping the exact meaning.',
        placeholder: 'Paste the passage to reword…',
      },
    ],
  },
  {
    heading: 'Discover',
    tools: [
      {
        task: 'title',
        label: 'Titles',
        blurb: 'Five publishable title options.',
        placeholder: 'Paste your abstract or a paragraph describing the study…',
      },
      {
        task: 'keywords',
        label: 'Keywords',
        blurb: 'Indexing keywords + classifications for discoverability.',
        placeholder: 'Paste your title and abstract…',
      },
      {
        task: 'summary',
        label: 'Plain summary',
        blurb: 'A lay summary of your work for a general audience.',
        placeholder: 'Paste your abstract or key results…',
      },
      {
        task: 'questions',
        label: 'Research questions',
        blurb: 'Questions, gaps, and hypotheses to pursue in your area.',
        placeholder: 'Describe your topic, field, or the gap you are exploring…',
      },
    ],
  },
];

const ALL_TOOLS: Tool[] = GROUPS.flatMap((g) => g.tools);

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
  const [directive, setDirective] = useState('');
  const [refining, setRefining] = useState(false);

  const active = ALL_TOOLS.find((t) => t.task === task)!;
  const words = material.trim() ? material.trim().split(/\s+/).length : 0;

  async function call(body: { task: string; material: string; directive?: string }) {
    const res = await fetch('/api/v1/assistant', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error?.message ?? 'Something went wrong. Please try again.');
    return json.data as AssistantResult;
  }

  async function run() {
    setLoading(true);
    setError(null);
    setResult(null);
    setCopied(false);
    setDirective('');
    try {
      setResult(await call({ task, material }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  // Iterative refine: revise the current result with a plain-language instruction
  // ("make it shorter", "more formal", "British spelling"). Feeds the result back
  // as the material under the `refine` task.
  async function refine() {
    if (!result || directive.trim().length < 2) return;
    setRefining(true);
    setError(null);
    setCopied(false);
    try {
      const refined = await call({ task: 'refine', material: result.text, directive });
      setResult(refined);
      setDirective('');
    } catch (e) {
      setError((e as Error).message);
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

  return (
    <Card className="p-6">
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
                    setDirective('');
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
        <Button onClick={run} disabled={loading || material.trim().length < 8} size="sm">
          {loading ? 'Working…' : active.label}
        </Button>
        <span className="text-xs text-rt-muted">
          {words} word{words === 1 ? '' : 's'} · {material.trim().length} characters
        </span>
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
          <div className="mt-3 whitespace-pre-wrap rounded-lg border border-rt-border bg-rt-blue-light/30 p-4 text-sm leading-relaxed text-rt-text">
            {result.text || 'No output — try adding more detail.'}
          </div>

          {result.offline ? (
            <p className="mt-2 text-xs text-rt-muted">
              This is the on-platform scaffold. Ask an administrator to enable the full AI provider
              for complete drafting.
            </p>
          ) : (
            // Iterative refine — only meaningful with the full provider.
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                value={directive}
                onChange={(e) => setDirective(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void refine();
                }}
                placeholder="Refine this… e.g. make it shorter, more formal, British spelling"
                className="min-w-0 flex-1 rounded-lg border border-rt-border bg-rt-white px-3 py-1.5 text-sm text-rt-text focus:border-rt-blue focus:outline-none focus:ring-1 focus:ring-rt-blue"
              />
              <Button
                onClick={refine}
                disabled={refining || directive.trim().length < 2}
                size="sm"
                variant="secondary"
              >
                {refining ? 'Refining…' : 'Refine'}
              </Button>
            </div>
          )}

          <p className="mt-3 text-xs text-rt-muted">{result.disclaimer}</p>
        </div>
      ) : null}
    </Card>
  );
}
