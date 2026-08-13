/**
 * Identity resolution report (Discovery Engine §9, §10, §25, §26).
 *
 * Produces an **explainable** identity-confidence score from multiple evidence
 * signals — never name alone. This score is a DISTINCT construct from the RVM:
 * it answers "how sure are we this is the same person", never "how visible is
 * their research" (§26, §54). The point weights are configurable (§9).
 */

export interface IdentityWeights {
  orcidExact: number;
  institution: number;
  coauthor: number;
  topic: number;
  affiliation: number;
  name: number;
}

/** Default weights sum to 100 (Discovery Engine §9). */
export const DEFAULT_IDENTITY_WEIGHTS: IdentityWeights = {
  orcidExact: 50,
  institution: 15,
  coauthor: 10,
  topic: 10,
  affiliation: 10,
  name: 5,
};

export interface IdentitySignals {
  /** Both records carry the *same* ORCID (the single strongest signal). */
  orcidExact?: boolean | undefined;
  institutionMatch?: boolean | undefined;
  affiliationMatch?: boolean | undefined;
  /** Count of overlapping co-authors between the two records. */
  coauthorOverlap?: number | undefined;
  /** 0..1 topic-profile similarity. */
  topicSimilarity?: number | undefined;
  /** 0..1 name similarity. */
  nameSimilarity?: number | undefined;
}

export type IdentityTier =
  | 'very_high' // 95-100
  | 'high' // 85-94
  | 'moderate' // 70-84
  | 'review' // 50-69
  | 'do_not_associate'; // < 50

export interface IdentityFactor {
  key: keyof IdentityWeights;
  label: string;
  /** Points contributed by this factor. */
  points: number;
  /** Points available for this factor. */
  max: number;
}

export interface IdentityReport {
  /** 0..100 identity confidence — NOT the RVM. */
  confidence: number;
  tier: IdentityTier;
  factors: IdentityFactor[];
  /** Human-readable explanation of the match (Discovery Engine §25). */
  reasons: string[];
}

function tierFor(confidence: number): IdentityTier {
  if (confidence >= 95) return 'very_high';
  if (confidence >= 85) return 'high';
  if (confidence >= 70) return 'moderate';
  if (confidence >= 50) return 'review';
  return 'do_not_associate';
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/**
 * Build an explainable identity report from evidence signals. Deterministic and
 * pure. ORCID contributes the most but is never, on its own, treated as proof
 * of *account ownership* — that requires OAuth at claim time (§8, §12).
 */
export function buildIdentityReport(
  signals: IdentitySignals,
  weights: IdentityWeights = DEFAULT_IDENTITY_WEIGHTS,
): IdentityReport {
  const factors: IdentityFactor[] = [];
  const reasons: string[] = [];

  const orcidPts = signals.orcidExact ? weights.orcidExact : 0;
  factors.push({ key: 'orcidExact', label: 'ORCID iD match', points: orcidPts, max: weights.orcidExact });
  if (orcidPts > 0) reasons.push('ORCID iD matches');

  const instPts = signals.institutionMatch ? weights.institution : 0;
  factors.push({ key: 'institution', label: 'Institution match', points: instPts, max: weights.institution });
  if (instPts > 0) reasons.push('Institution matches');

  // Co-author overlap saturates the available points at 5 shared co-authors.
  const overlap = Math.max(0, signals.coauthorOverlap ?? 0);
  const coPts = Math.round(Math.min(1, overlap / 5) * weights.coauthor);
  factors.push({ key: 'coauthor', label: 'Co-author overlap', points: coPts, max: weights.coauthor });
  if (overlap > 0) reasons.push(`${overlap} co-author${overlap === 1 ? '' : 's'} overlap`);

  const topicPts = Math.round(clamp01(signals.topicSimilarity ?? 0) * weights.topic);
  factors.push({ key: 'topic', label: 'Topic similarity', points: topicPts, max: weights.topic });
  if (topicPts > 0) reasons.push('Research topics are consistent');

  const affPts = signals.affiliationMatch ? weights.affiliation : 0;
  factors.push({ key: 'affiliation', label: 'Affiliation match', points: affPts, max: weights.affiliation });
  if (affPts > 0) reasons.push('Affiliation matches');

  const namePts = Math.round(clamp01(signals.nameSimilarity ?? 0) * weights.name);
  factors.push({ key: 'name', label: 'Name similarity', points: namePts, max: weights.name });
  if (namePts > 0) reasons.push('Name is similar');

  const confidence = Math.max(
    0,
    Math.min(100, factors.reduce((sum, f) => sum + f.points, 0)),
  );

  return { confidence, tier: tierFor(confidence), factors, reasons };
}

/**
 * Guard for automatic association (Discovery Engine §10). Never associate below
 * a configurable threshold, and never on name similarity alone.
 */
export function mayAutoAssociate(report: IdentityReport, threshold = 85): boolean {
  const onlyName =
    report.factors.every((f) => f.key === 'name' || f.points === 0) &&
    (report.factors.find((f) => f.key === 'name')?.points ?? 0) > 0;
  return report.confidence >= threshold && !onlyName;
}
