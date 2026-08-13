import { prisma, type PrismaClient } from '@researchtrics/db';
import { logger } from './logger';

/**
 * Anti-fraud signals for profile claiming (Discovery Engine §32, §33; Phase 15).
 *
 * Three grounded signal families:
 *   1. Fake / disposable email domains (§33) — pure, list-based.
 *   2. Rapid-claim velocity (§33) — counted from real claim records.
 *   3. Duplicate-account pressure on one profile (§33) — counted from real
 *      pending claims on the same researcher.
 *
 * Every signal is derived from data that actually exists. A risk assessment is
 * advisory — it *flags for review*, it never fabricates guilt, and it never
 * silently deletes or accuses. High risk routes a claim to manual review rather
 * than auto-completing; it does not assert the actor is malicious.
 */

export type RiskLevel = 'low' | 'elevated' | 'high';

export interface RiskSignal {
  readonly code: string;
  readonly detail: string;
  /** Contribution to the risk score (0..1). */
  readonly weight: number;
}

export interface RiskAssessment {
  readonly level: RiskLevel;
  /** 0..1 aggregate. */
  readonly score: number;
  readonly signals: RiskSignal[];
  /** True when the action should be held for manual review rather than auto-run. */
  readonly requiresReview: boolean;
}

/**
 * Known disposable / throwaway email domains (§33). Deliberately small and
 * explicit — we flag, we do not hard-block, and the list is auditable. Real
 * deployments extend this from a maintained source; nothing is inferred.
 */
export const DISPOSABLE_EMAIL_DOMAINS: ReadonlySet<string> = new Set([
  'mailinator.com',
  'guerrillamail.com',
  'guerrillamail.info',
  '10minutemail.com',
  'tempmail.com',
  'temp-mail.org',
  'throwawaymail.com',
  'yopmail.com',
  'trashmail.com',
  'getnada.com',
  'dispostable.com',
  'sharklasers.com',
  'maildrop.cc',
  'fakeinbox.com',
]);

/**
 * Free consumer-webmail domains. Not disposable and not blocked — but a claim
 * verified only by a free-webmail address proves control of that mailbox, not
 * an *institutional* affiliation (§13). We surface it as a weak signal so the
 * UI can label verification honestly, never as fraud.
 */
export const FREE_WEBMAIL_DOMAINS: ReadonlySet<string> = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'icloud.com',
  'proton.me',
  'protonmail.com',
  'aol.com',
  'gmx.com',
  'mail.com',
  'yandex.com',
]);

export function emailDomain(email: string): string {
  const at = email.lastIndexOf('@');
  return at === -1 ? '' : email.slice(at + 1).trim().toLowerCase();
}

export function isDisposableEmail(email: string): boolean {
  return DISPOSABLE_EMAIL_DOMAINS.has(emailDomain(email));
}

export function isFreeWebmail(email: string): boolean {
  return FREE_WEBMAIL_DOMAINS.has(emailDomain(email));
}

/**
 * True when a domain looks institutional enough to carry weight for a claim —
 * i.e. not disposable and not free consumer webmail. This is a heuristic label,
 * not a guarantee of institutional identity.
 */
export function looksInstitutional(email: string): boolean {
  const d = emailDomain(email);
  return d.length > 0 && !DISPOSABLE_EMAIL_DOMAINS.has(d) && !FREE_WEBMAIL_DOMAINS.has(d);
}

const LEVEL_ORDER: Record<RiskLevel, number> = { low: 0, elevated: 1, high: 2 };

/** Combine signals into an assessment. Score is the clamped sum of weights. */
export function assess(signals: RiskSignal[]): RiskAssessment {
  const score = Math.min(1, signals.reduce((s, sig) => s + sig.weight, 0));
  let level: RiskLevel = 'low';
  if (score >= 0.7) level = 'high';
  else if (score >= 0.3) level = 'elevated';
  return {
    level,
    score: Math.round(score * 100) / 100,
    signals,
    requiresReview: LEVEL_ORDER[level] >= LEVEL_ORDER.elevated,
  };
}

export interface ClaimRiskInput {
  /** The account attempting the claim. */
  readonly userId: string;
  readonly researcherId: string;
  /** The email evidence, if the institutional path is used. */
  readonly email?: string;
  /** How far back to count claim velocity (default 1h). */
  readonly velocityWindowMs?: number;
  /** Claims by one user within the window above this count is rapid (default 3). */
  readonly velocityThreshold?: number;
}

/**
 * Assess the risk of a claim attempt from real records (§33). Pure detectors
 * (email) plus grounded counts (velocity, contested profile). Read-only — it
 * decides nothing on its own; the caller uses `requiresReview` to route the
 * claim to manual review instead of auto-completing.
 */
export async function assessClaimRisk(
  input: ClaimRiskInput,
  client: PrismaClient = prisma,
): Promise<RiskAssessment> {
  const windowMs = input.velocityWindowMs ?? 60 * 60_000;
  const threshold = input.velocityThreshold ?? 3;
  const signals: RiskSignal[] = [];

  if (input.email) {
    if (isDisposableEmail(input.email)) {
      signals.push({
        code: 'disposable_email',
        detail: `Email domain ${emailDomain(input.email)} is a known disposable provider`,
        weight: 0.7,
      });
    } else if (isFreeWebmail(input.email)) {
      signals.push({
        code: 'free_webmail',
        detail: `Email domain ${emailDomain(input.email)} is free consumer webmail, not institutional`,
        weight: 0.2,
      });
    }
  }

  const since = new Date(Date.now() - windowMs);

  // Velocity: recent publication-claim rows created by this user's researcher(s).
  const usersResearchers = await client.researcher.findMany({
    where: { userId: input.userId },
    select: { id: true },
  });
  const researcherIds = usersResearchers.map((r) => r.id);
  if (researcherIds.length > 0) {
    const recentClaims = await client.researcherPublicationClaim.count({
      where: { researcherId: { in: researcherIds }, createdAt: { gte: since } },
    });
    if (recentClaims > threshold) {
      signals.push({
        code: 'rapid_claim_velocity',
        detail: `${recentClaims} publication claims in the last ${Math.round(windowMs / 60_000)} min exceeds ${threshold}`,
        weight: 0.5,
      });
    }
  }

  // Contested profile: multiple distinct pending claimants competing for one
  // researcher is a duplicate-account / takeover signal (§33).
  const pendingInvites = await client.claimInvitation.count({
    where: { researcherId: input.researcherId, status: 'pending' },
  });
  if (pendingInvites >= 3) {
    signals.push({
      code: 'contested_profile',
      detail: `${pendingInvites} pending claim invitations on this profile`,
      weight: 0.4,
    });
  }

  return assess(signals);
}

/**
 * Record a security event to the audit log (§35). Advisory and append-only —
 * used for review dashboards and post-hoc analysis, never to auto-punish.
 */
export async function recordSecurityEvent(
  event: {
    action: string;
    actorId?: string;
    entityType: string;
    entityId?: string;
    detail?: unknown;
    ip?: string;
  },
  client: PrismaClient = prisma,
): Promise<void> {
  try {
    await client.auditLog.create({
      data: {
        action: event.action,
        actorId: event.actorId ?? null,
        entityType: event.entityType,
        entityId: event.entityId ?? null,
        after: event.detail === undefined ? undefined : (event.detail as object),
        ip: event.ip ?? null,
      },
    });
  } catch (err) {
    // Audit must never break the primary flow.
    logger.warn({ err, action: event.action }, 'Failed to record security event');
  }
}
