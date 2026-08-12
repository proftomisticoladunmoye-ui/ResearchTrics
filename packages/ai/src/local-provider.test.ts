import { describe, it, expect } from 'vitest';
import { LocalProvider } from './local-provider';
import { createAIProvider } from './index';
import type { GroundedContext } from './types';

const ctx: GroundedContext = {
  task: 'profile-summary',
  instruction: 'Summarize this researcher.',
  facts: [
    { ref: 'RTX-1', kind: 'profile', text: 'Ada Lovelace is a researcher on ResearchTrics' },
    { ref: 'aff:1', kind: 'affiliation', text: 'Affiliated with the University of London (United Kingdom)' },
    { ref: 'int:1', kind: 'interest', text: 'Lists research interests: analytical engines, mathematics' },
    { ref: 'RTP-1', kind: 'publication', text: 'Has 1 publication recorded, including "Notes on the Analytical Engine" (1843)' },
  ],
};

describe('LocalProvider', () => {
  it('is on-platform (never external)', () => {
    const p = new LocalProvider();
    expect(p.external).toBe(false);
    expect(p.name).toBe('local');
  });

  it('grounds every generation strictly in the supplied facts', async () => {
    const gen = await new LocalProvider().generateGrounded(ctx);
    expect(gen.grounded).toBe(true);
    // Sources must be a subset of the provided refs — no fabricated citations.
    const refs = new Set(ctx.facts.map((f) => f.ref));
    expect(gen.sources.every((s) => refs.has(s))).toBe(true);
    // Text restates the records verbatim; no claim appears that was not supplied.
    expect(gen.text).toContain('Ada Lovelace');
    expect(gen.text).toContain('Notes on the Analytical Engine');
  });

  it('is deterministic — identical input yields identical output', async () => {
    const a = await new LocalProvider().generateGrounded(ctx);
    const b = await new LocalProvider().generateGrounded(ctx);
    expect(a.text).toBe(b.text);
  });

  it('orders facts into a natural paragraph regardless of input order', async () => {
    const shuffled: GroundedContext = { ...ctx, facts: [...ctx.facts].reverse() };
    const gen = await new LocalProvider().generateGrounded(shuffled);
    // profile fact leads, publication fact trails
    expect(gen.text.indexOf('Ada Lovelace')).toBeLessThan(gen.text.indexOf('Analytical Engine'));
  });

  it('drops empty and duplicate facts', async () => {
    const gen = await new LocalProvider().generateGrounded({
      ...ctx,
      facts: [
        { ref: 'a', kind: 'profile', text: 'Same fact' },
        { ref: 'b', kind: 'profile', text: 'Same fact' },
        { ref: 'c', kind: 'profile', text: '   ' },
      ],
    });
    expect(gen.sources).toEqual(['a']);
    expect(gen.text).toBe('Same fact.');
  });
});

describe('createAIProvider', () => {
  it('defaults to the local provider', () => {
    const { provider, fellBack } = createAIProvider();
    expect(provider.name).toBe('local');
    expect(fellBack).toBe(false);
  });

  it('falls back to local when claude is requested without a key', () => {
    const { provider, fellBack } = createAIProvider({ provider: 'claude' });
    expect(provider.name).toBe('local');
    expect(fellBack).toBe(true);
  });

  it('returns the claude provider when a key is configured', () => {
    const { provider, fellBack } = createAIProvider({ provider: 'claude', apiKey: 'sk-test' });
    expect(provider.name).toBe('claude');
    expect(provider.external).toBe(true);
    expect(fellBack).toBe(false);
  });
});
