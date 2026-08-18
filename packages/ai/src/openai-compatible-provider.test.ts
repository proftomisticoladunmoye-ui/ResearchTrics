import { describe, it, expect } from 'vitest';
import { OpenAICompatibleProvider } from './openai-compatible-provider';
import { createAIProvider, LocalProvider } from './index';
import type { GroundedContext } from './types';

const summaryCtx: GroundedContext = {
  task: 'profile-summary',
  instruction: 'Summarize.',
  facts: [{ ref: 'RTX-1', kind: 'profile', text: 'Dr Ada is a researcher.' }],
};

const assistCtx: GroundedContext = {
  task: 'assist:abstract',
  mode: 'assist',
  instruction: 'Draft an abstract.',
  facts: [],
  material: 'We piloted a numeracy intervention across ten schools.',
};

describe('OpenAICompatibleProvider (injected fetch — offline)', () => {
  it('POSTs to /chat/completions with bearer auth + model, parses the choice', async () => {
    let url = '';
    let auth = '';
    let sentBody: { model: string; messages: Array<{ role: string; content: string }> } | null = null;
    const fakeFetch = (async (u: string, init?: RequestInit) => {
      url = u;
      auth = String((init?.headers as Record<string, string>).authorization);
      sentBody = JSON.parse(String(init?.body));
      return {
        ok: true,
        json: async () => ({ choices: [{ message: { content: '  A grounded summary.  ' } }] }),
      };
    }) as unknown as typeof fetch;

    const provider = new OpenAICompatibleProvider({
      apiKey: 'secret',
      model: 'anthropic/claude-haiku-4.5',
      fetchImpl: fakeFetch,
    });
    const gen = await provider.generateGrounded(summaryCtx);

    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(auth).toBe('Bearer secret');
    expect(sentBody!.model).toBe('anthropic/claude-haiku-4.5');
    expect(sentBody!.messages[0]!.role).toBe('system');
    expect(sentBody!.messages[0]!.content).toContain('ONLY the verified platform records');
    expect(gen.text).toBe('A grounded summary.');
    expect(gen.model).toBe('openrouter:anthropic/claude-haiku-4.5');
    expect(gen.external).toBe(true);
  });

  it('uses the assist system prompt in assist mode and sends the material', async () => {
    let sentBody: { model: string; messages: Array<{ role: string; content: string }> } | null = null;
    const fakeFetch = (async (_u: string, init?: RequestInit) => {
      sentBody = JSON.parse(String(init?.body));
      return { ok: true, json: async () => ({ choices: [{ message: { content: 'Draft.' } }] }) };
    }) as unknown as typeof fetch;

    await new OpenAICompatibleProvider({ apiKey: 'k', model: 'x/y', fetchImpl: fakeFetch }).generateGrounded(
      assistCtx,
    );
    expect(sentBody!.messages[0]!.content).toContain('NEVER fabricate evidence');
    expect(sentBody!.messages[1]!.content).toContain('numeracy intervention');
  });

  it('honors a custom base URL', async () => {
    let url = '';
    const fakeFetch = (async (u: string) => {
      url = u;
      return { ok: true, json: async () => ({ choices: [{ message: { content: 'ok' } }] }) };
    }) as unknown as typeof fetch;
    await new OpenAICompatibleProvider({
      apiKey: 'k',
      model: 'x/y',
      baseUrl: 'https://gateway.example.com/v1/',
      fetchImpl: fakeFetch,
    }).generateGrounded(summaryCtx);
    expect(url).toBe('https://gateway.example.com/v1/chat/completions');
  });

  it('throws on a non-ok response', async () => {
    const fakeFetch = (async () => ({ ok: false, status: 429, text: async () => 'rate limited' })) as unknown as typeof fetch;
    const provider = new OpenAICompatibleProvider({ apiKey: 'k', model: 'x/y', fetchImpl: fakeFetch });
    await expect(provider.generateGrounded(summaryCtx)).rejects.toThrow('429');
  });

  it('refuses to transmit private data (Spec §92)', async () => {
    const provider = new OpenAICompatibleProvider({ apiKey: 'k', model: 'x/y' });
    await expect(
      provider.generateGrounded({ ...summaryCtx, containsPrivate: true }),
    ).rejects.toThrow('private');
  });
});

describe('createAIProvider factory — openrouter', () => {
  it('resolves openrouter when a key is set', () => {
    const { provider, fellBack } = createAIProvider({
      provider: 'openrouter',
      apiKey: 'k',
      model: 'anthropic/claude-haiku-4.5',
    });
    expect(provider).toBeInstanceOf(OpenAICompatibleProvider);
    expect(provider.name).toBe('openrouter');
    expect(fellBack).toBe(false);
  });

  it('falls back to local (flagged) when openrouter is requested with no key', () => {
    const { provider, fellBack } = createAIProvider({ provider: 'openrouter' });
    expect(provider).toBeInstanceOf(LocalProvider);
    expect(fellBack).toBe(true);
  });

  it('accepts openai-compatible as an alias', () => {
    const { provider } = createAIProvider({ provider: 'openai-compatible', apiKey: 'k', model: 'x/y' });
    expect(provider).toBeInstanceOf(OpenAICompatibleProvider);
  });
});
