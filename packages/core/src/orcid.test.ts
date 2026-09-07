import { describe, it, expect } from 'vitest';
import { normalizeOrcid } from './orcid';

describe('normalizeOrcid', () => {
  it('keeps a well-formed bare ORCID', () => {
    expect(normalizeOrcid('0000-0002-1825-0097')).toBe('0000-0002-1825-0097');
  });

  it('strips a full orcid.org URL to the bare identifier', () => {
    expect(normalizeOrcid('https://orcid.org/0000-0002-1825-0097')).toBe('0000-0002-1825-0097');
    expect(normalizeOrcid('http://orcid.org/0000-0002-1825-0097')).toBe('0000-0002-1825-0097');
  });

  it('re-hyphenates a run of 16 digits', () => {
    expect(normalizeOrcid('0000000218250097')).toBe('0000-0002-1825-0097');
  });

  it('preserves a trailing X checksum', () => {
    expect(normalizeOrcid('https://orcid.org/0000-0002-1694-233X')).toBe('0000-0002-1694-233X');
    expect(normalizeOrcid('0000-0002-1694-233x')).toBe('0000-0002-1694-233X');
  });

  it('returns undefined for empty or malformed input', () => {
    expect(normalizeOrcid(undefined)).toBeUndefined();
    expect(normalizeOrcid(null)).toBeUndefined();
    expect(normalizeOrcid('')).toBeUndefined();
    expect(normalizeOrcid('not-an-orcid')).toBeUndefined();
    expect(normalizeOrcid('0000-0002-1825')).toBeUndefined(); // too short
  });
});
