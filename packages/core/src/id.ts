import {
  RESEARCHTRICS_ID_PREFIX,
  RESEARCHTRICS_ID_PAD,
  OUTPUT_ID_PREFIXES,
  OPPORTUNITY_ID_PREFIX,
  WORK_ID_PREFIX,
} from '@researchtrics/config';

/**
 * Format a persistent public researcher identity from a serial number (Spec §7).
 * Example: 1 -> "RTX-00000001". Pure & deterministic (unit-tested).
 */
export function formatResearchtricsId(serial: number): string {
  if (!Number.isInteger(serial) || serial < 1) {
    throw new Error(`Invalid researcher serial: ${serial}`);
  }
  return `${RESEARCHTRICS_ID_PREFIX}-${String(serial).padStart(RESEARCHTRICS_ID_PAD, '0')}`;
}

/** Format a per-output public ID (Spec §9). Example: ("publication", 42) -> "RTP-00000042". */
export function formatOutputId(kind: keyof typeof OUTPUT_ID_PREFIXES, serial: number): string {
  if (!Number.isInteger(serial) || serial < 1) {
    throw new Error(`Invalid output serial: ${serial}`);
  }
  return `${OUTPUT_ID_PREFIXES[kind]}-${String(serial).padStart(RESEARCHTRICS_ID_PAD, '0')}`;
}

/** Format a public opportunity ID (Phase 13). Example: 7 -> "RTO-00000007". */
export function formatOpportunityId(serial: number): string {
  if (!Number.isInteger(serial) || serial < 1) {
    throw new Error(`Invalid opportunity serial: ${serial}`);
  }
  return `${OPPORTUNITY_ID_PREFIX}-${String(serial).padStart(RESEARCHTRICS_ID_PAD, '0')}`;
}

/** Format a unified work record public ID (Federation §16). Example: 3 -> "RTW-00000003". */
export function formatWorkId(serial: number): string {
  if (!Number.isInteger(serial) || serial < 1) {
    throw new Error(`Invalid work serial: ${serial}`);
  }
  return `${WORK_ID_PREFIX}-${String(serial).padStart(RESEARCHTRICS_ID_PAD, '0')}`;
}

/**
 * Build a URL-safe slug. Non-destructive: callers must ensure uniqueness
 * (slug history preserves redirects — Spec §71).
 */
export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '') // strip combining diacritical marks
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** Append a short disambiguator to a slug (used when a base slug collides). */
export function slugWithSuffix(base: string, suffix: string): string {
  const clean = slugify(base) || 'item';
  return `${clean}-${suffix}`.slice(0, 96);
}
