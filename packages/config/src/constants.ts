/** Platform-wide constants (Spec §7, §38). */

/** Public researcher identity prefix — RTX-00000001 (Spec §7). */
export const RESEARCHTRICS_ID_PREFIX = 'RTX';
export const RESEARCHTRICS_ID_PAD = 8;

/** Per-output public ID prefixes (Spec §9). */
export const OUTPUT_ID_PREFIXES = {
  publication: 'RTP',
  dataset: 'RTD',
  instrument: 'RTI',
  software: 'RTS',
  project: 'RTJ',
} as const;

/** Verification levels (Spec §38) — clearly labelled, never misleading. */
export const VERIFICATION_LEVELS = {
  0: { key: 'unverified', label: 'Unverified' },
  1: { key: 'email', label: 'Email verified' },
  2: { key: 'institution', label: 'Institution verified' },
  3: { key: 'orcid', label: 'ORCID verified' },
  4: { key: 'output', label: 'Research output verified' },
  5: { key: 'professional', label: 'Professional researcher verified' },
} as const;

export type VerificationLevel = keyof typeof VERIFICATION_LEVELS;

/** Identity-matching confidence thresholds (Spec §58). */
export const MATCH_CONFIDENCE = {
  strong: 0.95, // auto-associate
  likely: 0.8, // suggest, confirm
  review: 0.6, // manual review required
} as const;

/** Content visibility levels (Spec §36). */
export const VISIBILITY_LEVELS = ['public', 'researchers', 'institution', 'private'] as const;
export type VisibilityLevel = (typeof VISIBILITY_LEVELS)[number];

export const API_VERSION = 'v1';
