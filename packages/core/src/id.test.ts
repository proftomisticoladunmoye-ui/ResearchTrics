import { describe, it, expect } from 'vitest';
import { formatResearchtricsId, formatOutputId, slugify } from './id';

describe('formatResearchtricsId', () => {
  it('formats a serial as a zero-padded RTX id', () => {
    expect(formatResearchtricsId(1)).toBe('RTX-00000001');
    expect(formatResearchtricsId(42)).toBe('RTX-00000042');
    expect(formatResearchtricsId(12345678)).toBe('RTX-12345678');
  });

  it('rejects invalid serials', () => {
    expect(() => formatResearchtricsId(0)).toThrow();
    expect(() => formatResearchtricsId(-1)).toThrow();
    expect(() => formatResearchtricsId(1.5)).toThrow();
  });
});

describe('formatOutputId', () => {
  it('uses per-kind prefixes', () => {
    expect(formatOutputId('publication', 7)).toBe('RTP-00000007');
    expect(formatOutputId('dataset', 7)).toBe('RTD-00000007');
    expect(formatOutputId('instrument', 7)).toBe('RTI-00000007');
  });
});

describe('slugify', () => {
  it('produces url-safe slugs and strips diacritics', () => {
    expect(slugify('Measurement Invariance in Psychometrics')).toBe(
      'measurement-invariance-in-psychometrics',
    );
    expect(slugify('Étude sur la Résilience')).toBe('etude-sur-la-resilience');
    expect(slugify('  Hello---World!!  ')).toBe('hello-world');
  });
});
