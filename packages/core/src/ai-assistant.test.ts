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

  it('proofread and paraphrase never silently alter meaning offline', () => {
    const text = 'The intervention reduced anxiety scores in the sample.';
    expect(offlineAssist('proofread', text)).toBe(text);
    expect(offlineAssist('paraphrase', text)).toBe(text);
    expect(offlineAssist('refine', text)).toBe(text);
  });

  it('outline returns an IMRaD scaffold with a data placeholder, no invented findings', () => {
    const out = offlineAssist('outline', 'We evaluated a mobile clinic across five districts.');
    expect(out).toMatch(/Introduction/);
    expect(out).toMatch(/Methods/);
    expect(out).toMatch(/\[YOUR DATA\]/);
  });

  it('cover_letter is a placeholdered template, not invented specifics', () => {
    const out = offlineAssist('cover_letter', 'A study of maternal health outcomes.');
    expect(out).toMatch(/\[JOURNAL\]/);
    expect(out).toMatch(/\[AUTHOR\]/);
  });

  it('reviewer_response is a placeholdered template', () => {
    const out = offlineAssist('reviewer_response', 'Reviewer 1: the sample is small.');
    expect(out).toMatch(/\[DESCRIBE CHANGE\]/);
  });
});

describe('ASSISTANT_TASKS', () => {
  it('covers the full research-writing suite', () => {
    expect(ASSISTANT_TASKS).toEqual([
      'abstract',
      'title',
      'improve',
      'proofread',
      'paraphrase',
      'questions',
      'keywords',
      'summary',
      'outline',
      'cover_letter',
      'reviewer_response',
      'refine',
    ]);
  });
});
