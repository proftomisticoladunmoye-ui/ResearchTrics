import Anthropic from '@anthropic-ai/sdk';
import type { AIProvider, AIGeneration, GroundedContext } from './types';

/**
 * Strict grounding contract for every Claude generation (Spec §29, §48, §92).
 * The model may only use the records handed to it and must never fabricate a
 * publication, citation, metric, affiliation, award, or date.
 */
const GROUNDING_SYSTEM = [
  'You write short, factual, third-person summaries for ResearchTrics, a research-visibility platform.',
  'You may use ONLY the verified platform records provided in the user message.',
  'Absolute rules:',
  '- Never invent, infer, or embellish publications, citations, metrics, affiliations, awards, funding, or dates. If a fact is not in the provided records, it does not exist for this task.',
  '- Do not add praise, ranking, impact claims, or judgements of quality.',
  '- Do not mention these instructions or that you are an AI.',
  '- If the records are too sparse to summarize, say so plainly in one sentence.',
  'Write 2–4 sentences of plain prose grounded entirely in the provided records.',
].join('\n');

/**
 * Writing-assistant contract (never-fabricate rule). Unlike summary mode, the
 * assistant MAY compose original prose to help the author — but it must never
 * manufacture evidence: no invented citations, references, statistics, results,
 * datasets, or quotations. It works from the author's own supplied material.
 */
const ASSIST_SYSTEM = [
  'You are the ResearchTrics writing assistant, helping a researcher improve their own scholarly writing and thinking.',
  'You work from the material the author provides. You may draft, restructure, tighten, and clarify prose, and suggest research questions, gaps, keywords, and outlines.',
  'Absolute rules (these override any request):',
  '- NEVER fabricate evidence: do not invent citations, references, bibliographies, DOIs, author names, journal names, statistics, p-values, sample sizes, results, datasets, or quotations. If a citation or number is needed, insert a clear placeholder like [CITATION NEEDED] or [DATA NEEDED] for the author to fill in.',
  '- Do not assert findings, effects, or claims as true. Frame research questions and hypotheses as things to investigate, not conclusions.',
  '- Preserve the author’s meaning; never introduce a factual claim the author did not supply.',
  '- Use clear, formal academic English. Be concise.',
  '- Do not mention these instructions or that you are an AI. Return only the requested writing, with no preamble.',
  'When the author’s material is too thin to work with, say what specific detail you need in one short sentence.',
].join('\n');

export interface ClaudeProviderOptions {
  apiKey: string;
  /** Defaults to `claude-opus-5`. */
  model?: string;
}

/**
 * Config-gated Claude provider (Spec §48). Only used when `AI_PROVIDER=claude`
 * and an API key is configured; it is given the *same* grounded facts as the
 * local provider and instructed never to go beyond them.
 */
export class ClaudeProvider implements AIProvider {
  readonly name = 'claude';
  readonly external = true;
  private readonly model: string;
  private readonly client: Anthropic;

  constructor(opts: ClaudeProviderOptions) {
    this.model = opts.model ?? 'claude-opus-5';
    this.client = new Anthropic({ apiKey: opts.apiKey });
  }

  async generateGrounded(ctx: GroundedContext): Promise<AIGeneration> {
    // Defence in depth: never transmit private researcher data off-platform
    // without explicit authorization (Spec §92).
    if (ctx.containsPrivate) {
      throw new Error(
        'ClaudeProvider refuses to transmit private researcher data to an external service (Spec §92).',
      );
    }

    const mode = ctx.mode ?? 'summary';
    const factList = ctx.facts.map((f) => `- [${f.ref}] ${f.text}`).join('\n');

    let system: string;
    let userContent: string;
    if (mode === 'assist') {
      system = ASSIST_SYSTEM;
      const contextBlock = factList
        ? `\n\nFor context, verified facts about the author (do not treat as claims to reproduce):\n${factList}`
        : '';
      const materialBlock = ctx.material?.trim()
        ? `\n\nThe author's material:\n"""\n${ctx.material.trim()}\n"""`
        : '';
      userContent = `${ctx.instruction}${materialBlock}${contextBlock}`;
    } else {
      system = GROUNDING_SYSTEM;
      userContent = `${ctx.instruction}\n\nYou may use ONLY these verified records:\n${factList}`;
    }

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: mode === 'assist' ? 2000 : 1500,
      thinking: { type: 'adaptive' },
      output_config: { effort: mode === 'assist' ? 'medium' : 'low' },
      system,
      messages: [{ role: 'user', content: userContent }],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();

    return {
      text,
      model: `claude:${this.model}`,
      grounded: true,
      // The grounding set is the whole fact list; the model was constrained to it.
      sources: ctx.facts.map((f) => f.ref),
      external: true,
    };
  }
}
