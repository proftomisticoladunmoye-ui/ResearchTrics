import { describe, it, expect } from 'vitest';
import { computeMatchConfidence, nameSimilarity } from './matching';

describe('nameSimilarity', () => {
  it('is 1 for identical names (diacritics/case-insensitive)', () => {
    expect(nameSimilarity('José Álvarez', 'Jose Alvarez')).toBe(1);
    expect(nameSimilarity('Ada Lovelace', 'ada  lovelace')).toBe(1);
  });

  it('is lower for different names', () => {
    expect(nameSimilarity('Ada Lovelace', 'Alan Turing')).toBeLessThan(0.5);
  });
});

describe('computeMatchConfidence', () => {
  it('treats an exact ORCID as a strong match', () => {
    const r = computeMatchConfidence({ orcidExact: true, nameSimilarity: 0.1 });
    expect(r.tier).toBe('strong');
    expect(r.score).toBeGreaterThanOrEqual(0.95);
  });

  it('never reaches strong on name alone (Spec §58)', () => {
    const r = computeMatchConfidence({ nameSimilarity: 1 });
    expect(r.score).toBeLessThan(0.95);
    expect(r.tier).not.toBe('strong');
  });

  it('boosts with corroborating signals and explains why', () => {
    const r = computeMatchConfidence({
      nameSimilarity: 0.9,
      sameInstitution: true,
      sharedPublication: true,
    });
    expect(r.score).toBeGreaterThan(0.7);
    expect(r.reasons.length).toBeGreaterThanOrEqual(3);
  });

  it('rejects weak name-only matches', () => {
    const r = computeMatchConfidence({ nameSimilarity: 0.3 });
    expect(r.tier).toBe('reject');
  });
});
