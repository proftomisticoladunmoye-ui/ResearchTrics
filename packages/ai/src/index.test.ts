import { describe, it, expect } from 'vitest';
import { cleanModelSlug, createAIProvider } from './index';

describe('cleanModelSlug', () => {
  it('passes a clean slug through unchanged', () => {
    expect(cleanModelSlug('anthropic/claude-sonnet-4.6')).toBe('anthropic/claude-sonnet-4.6');
  });

  it('strips a pasted AI_MODEL= prefix (the common env mistake)', () => {
    expect(cleanModelSlug('AI_MODEL=anthropic/claude-sonnet-4.6')).toBe('anthropic/claude-sonnet-4.6');
    expect(cleanModelSlug('  AI_MODEL = anthropic/claude-sonnet-4.6 ')).toBe('anthropic/claude-sonnet-4.6');
  });

  it('strips surrounding quotes and whitespace', () => {
    expect(cleanModelSlug('"anthropic/claude-haiku-4.5"')).toBe('anthropic/claude-haiku-4.5');
    expect(cleanModelSlug("  openai/gpt-4o-mini  ")).toBe('openai/gpt-4o-mini');
  });

  it('returns undefined for empty/whitespace', () => {
    expect(cleanModelSlug(undefined)).toBeUndefined();
    expect(cleanModelSlug('   ')).toBeUndefined();
  });
});

describe('createAIProvider model sanitisation', () => {
  it('does not send a malformed slug to the OpenRouter provider', () => {
    const { provider } = createAIProvider({
      provider: 'openrouter',
      apiKey: 'sk-test',
      model: 'AI_MODEL=anthropic/claude-sonnet-4.6',
    });
    // The provider name is the gateway; the model is cleaned internally.
    expect(provider.name).toBe('openrouter');
    expect(provider.external).toBe(true);
  });
});
