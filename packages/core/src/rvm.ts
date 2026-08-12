/**
 * Research Visibility Metric — scoring engine (Spec §23–25).
 *
 * RVM is a *transparent, configurable* framework, NOT an arbitrary score. Every
 * indicator exposes its raw value, normalization, and weight; every dimension
 * exposes its inputs, weight, confidence, and missing data.
 *
 * INTEGRITY (Spec §23, §24):
 *  - RVM measures VISIBILITY — not impact, and not quality. These are distinct.
 *  - Weights below are PROVISIONAL defaults of a proprietary framework that is
 *    PENDING EMPIRICAL VALIDATION. Nothing here asserts psychometric validity.
 *  - The engine is pure and deterministic so scores are reproducible + testable.
 */

export const RVM_VERSION = 'rvm-proto-0.1';
export const RVM_FRAMEWORK_LABEL =
  'ResearchTrics proprietary research visibility framework (prototype, pending empirical validation)';

/** Raw, already-aggregated signals for one researcher. All counts are bot-filtered upstream. */
export interface RvmInput {
  publicationCount: number;
  withDoiCount: number;
  withAbstractCount: number;
  openAccessCount: number;
  citationTotal: number; // max across sources (never merged — Spec §33)
  distinctCitationSources: number;
  collaboratorCount: number;
  distinctInstitutionCount: number;
  distinctCountryCount: number;
  connectedOutputs: number; // datasets + instruments + software + projects
  datasetOpenCount: number;
  preprintCount: number;
  knowledgeTranslationCount: number; // policy/research briefs etc.
  hasOrcid: boolean;
  externalIdCount: number;
  hasWebsite: boolean;
  hasInstitutionalAffiliation: boolean;
  profileCompleteness: number; // 0..1
}

export type DimensionKey =
  | 'discoverability'
  | 'accessibility'
  | 'engagement'
  | 'citation_influence'
  | 'collaboration'
  | 'connectivity'
  | 'open_science'
  | 'knowledge_translation'
  | 'international_reach'
  | 'digital_presence';

export interface IndicatorBreakdown {
  key: string;
  label: string;
  raw: number;
  normalized: number; // 0..1
  weight: number;
  missing: boolean;
}

export interface DimensionScore {
  key: DimensionKey;
  name: string;
  score: number; // 0..100
  weight: number;
  indicators: IndicatorBreakdown[];
}

export interface RvmResult {
  version: string;
  overall: number; // 0..100
  confidence: number; // 0..1
  dimensions: DimensionScore[];
  missingData: string[];
  calculatedAt: string;
  /** Explicit reminder surfaced in the product. */
  disclaimer: string;
}

/** Dimension weights (provisional). Sum to 1. Configurable — data, not magic. */
export const DEFAULT_DIMENSION_WEIGHTS: Record<DimensionKey, number> = {
  discoverability: 0.14,
  accessibility: 0.12,
  engagement: 0.08,
  citation_influence: 0.14,
  collaboration: 0.1,
  connectivity: 0.1,
  open_science: 0.1,
  knowledge_translation: 0.08,
  international_reach: 0.06,
  digital_presence: 0.08,
};

const DIMENSION_NAMES: Record<DimensionKey, string> = {
  discoverability: 'Discoverability',
  accessibility: 'Accessibility',
  engagement: 'Scholarly Engagement',
  citation_influence: 'Citation Influence',
  collaboration: 'Collaboration Reach',
  connectivity: 'Research Connectivity',
  open_science: 'Open Science',
  knowledge_translation: 'Knowledge Translation',
  international_reach: 'International Reach',
  digital_presence: 'Digital Scholarly Presence',
};

/** Saturating normalizer: count/(count+k) → diminishing returns in [0,1). */
function sat(count: number, k: number): number {
  if (count <= 0) return 0;
  return count / (count + k);
}

/** Safe ratio a/b clamped to [0,1]; returns null (missing) when denominator is 0. */
function ratio(a: number, b: number): number | null {
  if (b <= 0) return null;
  return Math.max(0, Math.min(1, a / b));
}

function ind(
  key: string,
  label: string,
  raw: number,
  normalized: number | null,
  weight: number,
): IndicatorBreakdown {
  return {
    key,
    label,
    raw,
    normalized: normalized ?? 0,
    weight,
    missing: normalized === null,
  };
}

/** Weighted mean of indicator normalized values → 0..100. */
function dimensionScore(indicators: IndicatorBreakdown[]): number {
  const totalWeight = indicators.reduce((s, i) => s + i.weight, 0);
  if (totalWeight === 0) return 0;
  const weighted = indicators.reduce((s, i) => s + i.normalized * i.weight, 0);
  return Math.round((weighted / totalWeight) * 1000) / 10;
}

export function computeRvm(
  input: RvmInput,
  dimensionWeights: Record<DimensionKey, number> = DEFAULT_DIMENSION_WEIGHTS,
): RvmResult {
  const hasPubs = input.publicationCount > 0;

  const dims: DimensionScore[] = [];

  const push = (key: DimensionKey, indicators: IndicatorBreakdown[]) => {
    dims.push({
      key,
      name: DIMENSION_NAMES[key],
      score: dimensionScore(indicators),
      weight: dimensionWeights[key],
      indicators,
    });
  };

  push('discoverability', [
    ind('doi_coverage', 'DOI coverage', input.withDoiCount, ratio(input.withDoiCount, input.publicationCount), 0.5),
    ind('metadata_completeness', 'Abstract/metadata coverage', input.withAbstractCount, ratio(input.withAbstractCount, input.publicationCount), 0.3),
    ind('output_volume', 'Indexed outputs', input.publicationCount, hasPubs ? sat(input.publicationCount, 10) : null, 0.2),
  ]);

  push('accessibility', [
    ind('open_access_ratio', 'Open-access share', input.openAccessCount, ratio(input.openAccessCount, input.publicationCount), 0.7),
    ind('full_text', 'Full-text availability', input.openAccessCount, hasPubs ? sat(input.openAccessCount, 5) : null, 0.3),
  ]);

  // Engagement: real view/download signals arrive with analytics; the prototype
  // uses body-of-work surface area and marks it lower-confidence.
  push('engagement', [
    ind('output_surface', 'Available outputs (engagement surface)', input.publicationCount + input.connectedOutputs, input.publicationCount + input.connectedOutputs > 0 ? sat(input.publicationCount + input.connectedOutputs, 15) : null, 1),
  ]);

  push('citation_influence', [
    ind('citation_total', 'Citations (max across sources)', input.citationTotal, input.distinctCitationSources > 0 ? sat(input.citationTotal, 50) : null, 0.8),
    ind('citation_sources', 'Distinct citation sources', input.distinctCitationSources, input.distinctCitationSources > 0 ? sat(input.distinctCitationSources, 2) : null, 0.2),
  ]);

  push('collaboration', [
    ind('collaborators', 'Distinct collaborators', input.collaboratorCount, sat(input.collaboratorCount, 8), 0.6),
    ind('institutions', 'Distinct institutions', input.distinctInstitutionCount, sat(input.distinctInstitutionCount, 4), 0.4),
  ]);

  push('connectivity', [
    ind('connected_outputs', 'Datasets/instruments/software/projects linked', input.connectedOutputs, sat(input.connectedOutputs, 4), 1),
  ]);

  push('open_science', [
    ind('oa_ratio', 'Open-access share', input.openAccessCount, ratio(input.openAccessCount, input.publicationCount), 0.5),
    ind('open_data', 'Open datasets', input.datasetOpenCount, sat(input.datasetOpenCount, 2), 0.3),
    ind('preprints', 'Preprints', input.preprintCount, sat(input.preprintCount, 3), 0.2),
  ]);

  push('knowledge_translation', [
    ind('kt_outputs', 'Policy/knowledge-translation outputs', input.knowledgeTranslationCount, sat(input.knowledgeTranslationCount, 2), 1),
  ]);

  push('international_reach', [
    ind('countries', 'Distinct collaborator/affiliation countries', input.distinctCountryCount, sat(input.distinctCountryCount, 4), 1),
  ]);

  push('digital_presence', [
    ind('orcid', 'ORCID connected', input.hasOrcid ? 1 : 0, input.hasOrcid ? 1 : 0, 0.35),
    ind('external_ids', 'Linked external identifiers', input.externalIdCount, sat(input.externalIdCount, 2), 0.15),
    ind('profile_completeness', 'Profile completeness', Math.round(input.profileCompleteness * 100), input.profileCompleteness, 0.35),
    ind('website', 'Website / institutional profile', input.hasWebsite ? 1 : 0, input.hasWebsite ? 1 : 0, 0.15),
  ]);

  const totalDimWeight = dims.reduce((s, d) => s + d.weight, 0);
  const overall =
    totalDimWeight > 0
      ? Math.round((dims.reduce((s, d) => s + d.score * d.weight, 0) / totalDimWeight) * 10) / 10
      : 0;

  // Confidence = share of indicators that had data.
  const allIndicators = dims.flatMap((d) => d.indicators);
  const present = allIndicators.filter((i) => !i.missing).length;
  const confidence = allIndicators.length > 0 ? Math.round((present / allIndicators.length) * 100) / 100 : 0;

  const missingData = allIndicators.filter((i) => i.missing).map((i) => i.label);

  return {
    version: RVM_VERSION,
    overall,
    confidence,
    dimensions: dims,
    missingData,
    calculatedAt: new Date().toISOString(),
    disclaimer:
      'RVM measures research visibility — not impact, and not quality. ' + RVM_FRAMEWORK_LABEL + '.',
  };
}
