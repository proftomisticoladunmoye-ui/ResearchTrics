import { prisma, type PrismaClient } from '@researchtrics/db';

/**
 * Subscriptions & entitlements (§premium). Core visibility is always free; a
 * plan gates *depth* — more AI, web browsing, deep analytics, reports. Payment
 * is handled by an external processor (Stripe); this module only reads/writes
 * the plan and meters metered features.
 */

export type PlanTier = 'free' | 'premium';

export interface Entitlements {
  plan: PlanTier;
  /** Metered external AI generations allowed per calendar month. */
  aiMonthlyLimit: number;
  /** AI web browsing (real-source citations). */
  webBrowsing: boolean;
  /** Deep analytics (reader geography/trends, RVM history). */
  deepAnalytics: boolean;
  /** Downloadable impact/visibility reports. */
  reports: boolean;
}

const FREE: Entitlements = {
  plan: 'free',
  aiMonthlyLimit: 15,
  webBrowsing: false,
  deepAnalytics: false,
  reports: false,
};

const PREMIUM: Entitlements = {
  plan: 'premium',
  aiMonthlyLimit: 500,
  webBrowsing: true,
  deepAnalytics: true,
  reports: true,
};

/** Entitlements for a plan. Admins always get premium-level access. */
export function entitlementsFor(plan: PlanTier, opts: { admin?: boolean } = {}): Entitlements {
  return opts.admin || plan === 'premium' ? PREMIUM : FREE;
}

/** Current billing period as `YYYY-MM` (UTC). */
export function currentPeriod(now: Date = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** A researcher's effective plan (an expired premium reverts to free). */
export async function getResearcherPlan(
  researcherId: string,
  client: PrismaClient = prisma,
): Promise<{ plan: PlanTier; planUntil: Date | null }> {
  const r = await client.researcher.findUnique({
    where: { id: researcherId },
    select: { plan: true, planUntil: true },
  });
  if (!r) return { plan: 'free', planUntil: null };
  const active = r.plan === 'premium' && (!r.planUntil || r.planUntil.getTime() > Date.now());
  return { plan: active ? 'premium' : 'free', planUntil: r.planUntil };
}

/** Set (or clear) a researcher's plan — called by admin tools or a Stripe webhook. */
export async function setResearcherPlan(
  researcherId: string,
  plan: PlanTier,
  planUntil: Date | null = null,
  client: PrismaClient = prisma,
): Promise<void> {
  await client.researcher.update({ where: { id: researcherId }, data: { plan, planUntil } });
}

export async function getAssistantUsage(
  researcherId: string,
  period: string = currentPeriod(),
  client: PrismaClient = prisma,
): Promise<number> {
  const row = await client.assistantUsage.findUnique({
    where: { researcherId_period: { researcherId, period } },
    select: { count: true },
  });
  return row?.count ?? 0;
}

export async function incrementAssistantUsage(
  researcherId: string,
  client: PrismaClient = prisma,
): Promise<void> {
  const period = currentPeriod();
  await client.assistantUsage.upsert({
    where: { researcherId_period: { researcherId, period } },
    update: { count: { increment: 1 } },
    create: { researcherId, period, count: 1 },
  });
}

export interface PlanStatus {
  entitlements: Entitlements;
  aiUsed: number;
  aiRemaining: number;
}

/** One call for a page/route: plan entitlements + this month's AI usage. */
export async function getPlanStatus(
  researcherId: string,
  isAdmin: boolean,
  client: PrismaClient = prisma,
): Promise<PlanStatus> {
  const { plan } = await getResearcherPlan(researcherId, client);
  const entitlements = entitlementsFor(plan, { admin: isAdmin });
  const aiUsed = await getAssistantUsage(researcherId, currentPeriod(), client);
  return { entitlements, aiUsed, aiRemaining: Math.max(0, entitlements.aiMonthlyLimit - aiUsed) };
}
