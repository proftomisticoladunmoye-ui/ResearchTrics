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

    const factList = ctx.facts.map((f) => `- [${f.ref}] ${f.text}`).join('\n');
    const userContent = `${ctx.instruction}\n\nYou may use ONLY these verified records:\n${factList}`;

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1500,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'low' },
      system: GROUNDING_SYSTEM,
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
