import { describe, it, expect } from 'vitest';
import { extractKeywords, offlineAssist, ASSISTANT_TASKS } from './ai-assistant';

describe('extractKeywords', () => {
  it('pulls salient terms and drops stopwords/short words', () => {
    const kws = extractKeywords(
      'This study of psychometric measurement examines measurement invariance in psychometric testing.',
    );
    expect(kws).toContain('psychometric');
    expect(kws).toContain('measurement');
    expect(kws).not.toContain('this');
    expect(kws).not.toContain('of');
  });

  it('ranks by frequency', () => {
    const kws = extractKeywords('alpha alpha alpha beta beta gamma');
    expect(kws[0]).toBe('alpha');
    expect(kws[1]).toBe('beta');
  });

  it('returns nothing for empty input', () => {
    expect(extractKeywords('   ')).toEqual([]);
  });
});

describe('offlineAssist (deterministic, no fabrication)', () => {
  it('keywords derive only from the author text', () => {
    const out = offlineAssist('keywords', 'bioinformatics genomics genomics sequencing');
    expect(out).toMatch(/genomics/);
    expect(out).toMatch(/bioinformatics/);
  });

  it('improve never alters the author meaning offline (returns text unchanged)', () => {
    const text = 'The intervention reduced anxiety scores in the sample.';
    expect(offlineAssist('improve', text)).toBe(text);
  });

  it('abstract returns a scaffold with a result placeholder, not invented numbers', () => {
    const out = offlineAssist('abstract', 'We tested a new reading intervention in primary schools.');
    expect(out).toMatch(/\[RESULT NEEDED\]/);
    expect(out).not.toMatch(/\bp\s*[<=]/i); // no fabricated statistics
  });

  it('summary is drawn from the leading sentences of the author text', () => {
    const out = offlineAssist('summary', 'First sentence here. Second sentence here. Third one.');
    expect(out).toContain('First sentence here.');
  });
});

describe('ASSISTANT_TASKS', () => {
  it('covers the intended writing tasks', () => {
    expect(ASSISTANT_TASKS).toEqual(['abstract', 'title', 'improve', 'questions', 'keywords', 'summary']);
  });
});
