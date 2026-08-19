import type { AIProvider, AIGeneration, GroundedContext } from './types';
import { buildGroundedMessages } from './prompts';

/**
 * OpenAI-compatible chat provider (Spec §48) — talks the `/chat/completions`
 * wire format used by OpenRouter and other OpenAI-compatible gateways. Added so
 * deployments can route AI through a cost-effective backend of their choice
 * (e.g. OpenRouter) while keeping the SAME grounding + never-fabricate contracts
 * as the Anthropic provider (the system prompts are shared, model-agnostic).
 *
 * Dependency-free (uses `fetch`, injectable for offline tests), like the email
 * and opportunity-source providers.
 */

export interface OpenAICompatibleOptions {
  apiKey: string;
  /** Model slug, e.g. `anthropic/claude-haiku-4.5` or `openai/gpt-4o-mini`. */
  model: string;
  /** API base, default OpenRouter. No trailing slash. */
  baseUrl?: string;
  /** Provider name surfaced in trust labelling (default `openrouter`). */
  name?: string;
  /** Optional attribution headers OpenRouter uses for app ranking. */
  referer?: string;
  title?: string;
  /** Abort the request after this many ms (default 45000) so a slow/unreachable
   * upstream fails fast instead of hanging the caller's request. */
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string | null } }>;
  error?: { message?: string };
}

export class OpenAICompatibleProvider implements AIProvider {
  readonly name: string;
  readonly external = true;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly referer?: string;
  private readonly title?: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: OpenAICompatibleOptions) {
    this.apiKey = opts.apiKey;
    this.model = opts.model;
    this.baseUrl = (opts.baseUrl ?? 'https://openrouter.ai/api/v1').replace(/\/$/, '');
    this.name = opts.name ?? 'openrouter';
    if (opts.referer !== undefined) this.referer = opts.referer;
    if (opts.title !== undefined) this.title = opts.title;
    this.timeoutMs = opts.timeoutMs ?? 45000;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  async generateGrounded(ctx: GroundedContext): Promise<AIGeneration> {
    // Defence in depth: never transmit private researcher data off-platform
    // without explicit authorization (Spec §92).
    if (ctx.containsPrivate) {
      throw new Error(
        'OpenAICompatibleProvider refuses to transmit private researcher data to an external service (Spec §92).',
      );
    }

    const mode = ctx.mode ?? 'summary';
    const { system, user } = buildGroundedMessages(ctx);

    const headers: Record<string, string> = {
      'content-type': 'application/json',
      authorization: `Bearer ${this.apiKey}`,
    };
    if (this.referer) headers['HTTP-Referer'] = this.referer;
    if (this.title) headers['X-Title'] = this.title;

    // Bound the request: a slow or unreachable upstream must fail fast so the
    // caller can fall back, never hang the user's request indefinitely.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let res: Awaited<ReturnType<typeof fetch>>;
    try {
      res = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          model: this.model,
          max_tokens: mode === 'assist' ? 2000 : 1500,
          temperature: mode === 'assist' ? 0.4 : 0.2,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
      });
    } catch (err) {
      if (controller.signal.aborted) {
        throw new Error(`${this.name} request timed out after ${this.timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`OpenAI-compatible provider error ${res.status}: ${detail.slice(0, 300)}`);
    }

    const json = (await res.json()) as ChatCompletionResponse;
    if (json.error?.message) throw new Error(`OpenAI-compatible provider error: ${json.error.message}`);
    const text = (json.choices?.[0]?.message?.content ?? '').trim();

    return {
      text,
      model: `${this.name}:${this.model}`,
      grounded: true,
      sources: ctx.facts.map((f) => f.ref),
      external: true,
    };
  }
}
