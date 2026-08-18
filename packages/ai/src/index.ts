import type { AIProvider } from './types';
import { LocalProvider } from './local-provider';
import { ClaudeProvider } from './claude-provider';
import { OpenAICompatibleProvider } from './openai-compatible-provider';

export * from './types';
export * from './prompts';
export { LocalProvider } from './local-provider';
export { ClaudeProvider } from './claude-provider';
export { OpenAICompatibleProvider, type OpenAICompatibleOptions } from './openai-compatible-provider';

export interface AIProviderConfig {
  /** `local` (default, on-platform), `claude`, or `openrouter` (Spec §48). */
  provider?: string | undefined;
  /** Required for `claude` and `openrouter`. */
  apiKey?: string | undefined;
  /**
   * Model id. For `claude`, an Anthropic model (default `claude-opus-5`). For
   * `openrouter`, an OpenRouter slug like `anthropic/claude-haiku-4.5`.
   */
  model?: string | undefined;
  /** Override the API base (mainly for OpenAI-compatible gateways). */
  baseUrl?: string | undefined;
}

const DEFAULT_OPENROUTER_MODEL = 'anthropic/claude-haiku-4.5';

/**
 * Resolve the configured AI provider (Spec §48). Defaults to the on-platform
 * `LocalProvider`. If an external provider (`claude` / `openrouter`) is requested
 * but no API key is configured, this falls back to the local provider rather than
 * failing the request — AI features stay available and honestly labelled as
 * on-platform. The caller is told which provider was chosen so it can be surfaced
 * in trust labelling.
 */
export function createAIProvider(cfg: AIProviderConfig = {}): {
  provider: AIProvider;
  fellBack: boolean;
} {
  const requested = (cfg.provider ?? 'local').toLowerCase();

  if (requested === 'claude') {
    if (!cfg.apiKey) return { provider: new LocalProvider(), fellBack: true };
    return { provider: new ClaudeProvider({ apiKey: cfg.apiKey, model: cfg.model }), fellBack: false };
  }

  // OpenAI-compatible gateway (OpenRouter and similar) — for cost-effective
  // routing. Same grounding contracts; the model is chosen by the operator.
  if (requested === 'openrouter' || requested === 'openai-compatible') {
    if (!cfg.apiKey) return { provider: new LocalProvider(), fellBack: true };
    return {
      provider: new OpenAICompatibleProvider({
        apiKey: cfg.apiKey,
        model: cfg.model && cfg.model.includes('/') ? cfg.model : DEFAULT_OPENROUTER_MODEL,
        baseUrl: cfg.baseUrl,
        title: 'ResearchTrics',
        referer: 'https://www.researchtrics.com',
      }),
      fellBack: false,
    };
  }

  return { provider: new LocalProvider(), fellBack: false };
}
