import type { AIProvider } from './types';
import { LocalProvider } from './local-provider';
import { ClaudeProvider } from './claude-provider';

export * from './types';
export { LocalProvider } from './local-provider';
export { ClaudeProvider } from './claude-provider';

export interface AIProviderConfig {
  /** `local` (default, on-platform) or `claude` (Spec §48). */
  provider?: string | undefined;
  /** Required for the `claude` provider. */
  apiKey?: string | undefined;
  /** Model for the `claude` provider (default `claude-opus-5`). */
  model?: string | undefined;
}

/**
 * Resolve the configured AI provider (Spec §48). Defaults to the on-platform
 * `LocalProvider`. If `claude` is requested but no API key is configured, this
 * falls back to the local provider rather than failing the request — AI
 * features stay available and honestly labelled as on-platform. The caller is
 * told which provider was chosen so it can be surfaced in trust labelling.
 */
export function createAIProvider(cfg: AIProviderConfig = {}): {
  provider: AIProvider;
  fellBack: boolean;
} {
  const requested = (cfg.provider ?? 'local').toLowerCase();

  if (requested === 'claude') {
    if (!cfg.apiKey) {
      return { provider: new LocalProvider(), fellBack: true };
    }
    return {
      provider: new ClaudeProvider({ apiKey: cfg.apiKey, model: cfg.model }),
      fellBack: false,
    };
  }

  return { provider: new LocalProvider(), fellBack: false };
}
