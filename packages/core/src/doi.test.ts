import { describe, it, expect } from 'vitest';
import { isValidDoi, normalizeDoi, assertValidDoi } from './doi';

describe('DOI validation', () => {
  it('accepts valid DOIs and strips resolver prefixes', () => {
    expect(isValidDoi('10.1234/abc.def')).toBe(true);
    expect(isValidDoi('https://doi.org/10.1234/abc.def')).toBe(true);
    expect(isValidDoi('doi:10.1000/xyz123')).toBe(true);
    expect(normalizeDoi('https://dx.doi.org/10.1/AbC')).toBe('10.1/abc');
  });

  it('rejects invalid DOIs', () => {
    expect(isValidDoi('not-a-doi')).toBe(false);
    expect(isValidDoi('10./missing')).toBe(false);
    expect(isValidDoi('11.1234/abc')).toBe(false);
    expect(() => assertValidDoi('nope')).toThrow(/Invalid DOI/);
  });
});
