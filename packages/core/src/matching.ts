import { MATCH_CONFIDENCE } from '@researchtrics/config';

/**
 * Identity matching (Spec §58). Confidence-scored; never auto-merge on name
 * alone. A strong external identifier (ORCID) is decisive; otherwise a weighted
 * blend of name similarity + corroborating signals is used.
 */

export type MatchTier = 'strong' | 'likely' | 'review' | 'reject';

export interface MatchSignals {
  /** Both sides carry the same verified ORCID iD. */
  orcidExact?: boolean;
  /** Name similarity in [0,1] (see nameSimilarity). */
  nameSimilarity: number;
  /** Same (verified) institutional affiliation. */
  sameInstitution?: boolean;
  /** A shared co-authored publication is known. */
  sharedPublication?: boolean;
  /** A verified email matches. */
  emailMatch?: boolean;
}

export interface MatchResult {
  score: number; // 0..1
  tier: MatchTier;
  /** Human-readable reasons — recommendations must be explainable (Spec §29). */
  reasons: string[];
}

/** Normalized Levenshtein similarity in [0,1]. Pure and deterministic. */
export function nameSimilarity(a: string, b: string): number {
  const s = normalizeName(a);
  const t = normalizeName(b);
  if (!s && !t) return 1;
  if (!s || !t) return 0;
  if (s === t) return 1;
  const distance = levenshtein(s, t);
  return 1 - distance / Math.max(s.length, t.length);
}

function normalizeName(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const prev = new Array<number>(n + 1);
  const curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        (prev[j] ?? 0) + 1,
        (curr[j - 1] ?? 0) + 1,
        (prev[j - 1] ?? 0) + cost,
      );
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j] ?? 0;
  }
  return prev[n] ?? 0;
}

function tierFor(score: number): MatchTier {
  if (score >= MATCH_CONFIDENCE.strong) return 'strong';
  if (score >= MATCH_CONFIDENCE.likely) return 'likely';
  if (score >= MATCH_CONFIDENCE.review) return 'review';
  return 'reject';
}

/**
 * Combine signals into a confidence score + tier. ORCID exact match is
 * authoritative; otherwise name similarity is the base, boosted by
 * corroborating signals but never reaching "strong" on name alone (Spec §58).
 */
export function computeMatchConfidence(signals: MatchSignals): MatchResult {
  const reasons: string[] = [];

  if (signals.orcidExact) {
    return { score: 0.99, tier: 'strong', reasons: ['Matched on verified ORCID iD'] };
  }

  // Name alone is capped below the auto-associate threshold.
  let score = Math.min(signals.nameSimilarity * 0.7, 0.7);
  reasons.push(`Name similarity ${(signals.nameSimilarity * 100).toFixed(0)}%`);

  if (signals.sameInstitution) {
    score += 0.15;
    reasons.push('Shared institutional affiliation');
  }
  if (signals.sharedPublication) {
    score += 0.15;
    reasons.push('Shared co-authored publication');
  }
  if (signals.emailMatch) {
    score += 0.1;
    reasons.push('Verified email match');
  }

  score = Math.min(score, 0.94); // never reach "strong" without a strong identifier
  return { score, tier: tierFor(score), reasons };
}
