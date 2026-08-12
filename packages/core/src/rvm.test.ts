import { describe, it, expect } from 'vitest';
import { computeRvm, RVM_VERSION, type RvmInput } from './rvm';

const empty: RvmInput = {
  publicationCount: 0,
  withDoiCount: 0,
  withAbstractCount: 0,
  openAccessCount: 0,
  citationTotal: 0,
  distinctCitationSources: 0,
  collaboratorCount: 0,
  distinctInstitutionCount: 0,
  distinctCountryCount: 0,
  connectedOutputs: 0,
  datasetOpenCount: 0,
  preprintCount: 0,
  knowledgeTranslationCount: 0,
  hasOrcid: false,
  externalIdCount: 0,
  hasWebsite: false,
  hasInstitutionalAffiliation: false,
  profileCompleteness: 0,
};

const strong: RvmInput = {
  publicationCount: 20,
  withDoiCount: 20,
  withAbstractCount: 20,
  openAccessCount: 15,
  citationTotal: 300,
  distinctCitationSources: 2,
  collaboratorCount: 25,
  distinctInstitutionCount: 8,
  distinctCountryCount: 6,
  connectedOutputs: 10,
  datasetOpenCount: 4,
  preprintCount: 5,
  knowledgeTranslationCount: 3,
  hasOrcid: true,
  externalIdCount: 3,
  hasWebsite: true,
  hasInstitutionalAffiliation: true,
  profileCompleteness: 1,
};

describe('computeRvm', () => {
  it('produces 10 dimensions and a versioned, disclaimed result', () => {
    const r = computeRvm(strong);
    expect(r.version).toBe(RVM_VERSION);
    expect(r.dimensions).toHaveLength(10);
    expect(r.disclaimer).toMatch(/not impact, and not quality/);
  });

  it('scores a strong profile far above an empty one', () => {
    expect(computeRvm(strong).overall).toBeGreaterThan(computeRvm(empty).overall);
    expect(computeRvm(empty).overall).toBe(0);
  });

  it('bounds overall within 0..100', () => {
    const r = computeRvm(strong);
    expect(r.overall).toBeGreaterThan(0);
    expect(r.overall).toBeLessThanOrEqual(100);
  });

  it('reports missing data and lower confidence for an empty profile', () => {
    const r = computeRvm(empty);
    expect(r.missingData.length).toBeGreaterThan(0);
    // A complete profile has all indicators computable → higher confidence.
    expect(r.confidence).toBeLessThan(computeRvm(strong).confidence);
    expect(computeRvm(strong).confidence).toBe(1);
  });

  it('exposes transparent per-indicator raw/normalized/weight', () => {
    const disc = computeRvm(strong).dimensions.find((d) => d.key === 'discoverability');
    expect(disc?.indicators.some((i) => i.key === 'doi_coverage' && i.raw === 20)).toBe(true);
    expect(disc?.indicators.every((i) => i.normalized >= 0 && i.normalized <= 1)).toBe(true);
  });

  it('marks citation influence missing when there are no citation sources', () => {
    const r = computeRvm({ ...strong, citationTotal: 0, distinctCitationSources: 0 });
    const cit = r.dimensions.find((d) => d.key === 'citation_influence');
    expect(cit?.indicators.every((i) => i.missing)).toBe(true);
  });
});
