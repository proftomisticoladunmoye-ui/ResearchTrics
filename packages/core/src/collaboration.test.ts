import { describe, it, expect } from 'vitest';
import { scoreCollaborator } from './collaboration';

describe('scoreCollaborator', () => {
  it('always explains a recommendation (never unexplained — Spec §29)', () => {
    const r = scoreCollaborator({ sharedInterests: ['psychometrics'] });
    expect(r.reasons.length).toBeGreaterThan(0);
    expect(r.reasons[0]).toContain('psychometrics');
  });

  it('ranks more shared interests higher', () => {
    const one = scoreCollaborator({ sharedInterests: ['a'] });
    const three = scoreCollaborator({ sharedInterests: ['a', 'b', 'c'] });
    expect(three.score).toBeGreaterThan(one.score);
  });

  it('adds institution and country signals with reasons', () => {
    const r = scoreCollaborator({
      sharedInterests: ['measurement'],
      sameInstitution: true,
      institutionName: 'Demo University',
    });
    expect(r.reasons.some((x) => x.includes('Demo University'))).toBe(true);
    expect(r.score).toBeGreaterThan(scoreCollaborator({ sharedInterests: ['measurement'] }).score);
  });

  it('produces no reasons when there is no signal (filtered out upstream)', () => {
    expect(scoreCollaborator({ sharedInterests: [] }).reasons).toHaveLength(0);
  });

  it('caps the score at 1', () => {
    const r = scoreCollaborator({
      sharedInterests: ['a', 'b', 'c', 'd', 'e', 'f'],
      sameInstitution: true,
    });
    expect(r.score).toBeLessThanOrEqual(1);
  });
});
