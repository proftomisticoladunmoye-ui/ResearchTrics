import Anthropic from '@anthropic-ai/sdk';
import type { AIProvider, AIGeneration, GroundedContext } from './types';
import { buildGroundedMessages, buildChatSystem } from './prompts';

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
    const chat = ctx.messages && ctx.messages.length > 0;
    const system = chat ? buildChatSystem(ctx) : buildGroundedMessages(ctx).system;
    const messages = chat
      ? ctx.messages!.map((m) => ({ role: m.role, content: m.content }))
      : [{ role: 'user' as const, content: buildGroundedMessages(ctx).user }];

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: ctx.maxTokens ?? (mode === 'assist' ? 2000 : 1500),
      thinking: { type: 'adaptive' },
      output_config: { effort: mode === 'assist' ? 'medium' : 'low' },
      system,
      messages,
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
