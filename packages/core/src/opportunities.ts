import { prisma, type PrismaClient, type Prisma, type OpportunityType } from '@researchtrics/db';
import { type Actor, authorize } from './rbac';
import { forbidden, notFound, badRequest } from './errors';
import { formatOpportunityId, slugWithSuffix } from './id';
import { nextOpportunitySerial } from '@researchtrics/db';
import type { OpportunityProvider, OpportunityQuery } from './opportunity-sources';
import { logger } from './logger';

/**
 * Research opportunities (Phase 13, Spec §20, §29, §57).
 *
 * Opportunities are forward-looking listings (grants, fellowships, calls,
 * positions) that researchers discover. Two integrity rules hold throughout:
 * every listing carries **provenance** (who posted it / where it came from) so
 * nothing is fabricated, and every match a researcher sees is **explained**
 * (Spec §29) — never an unexplained score.
 */

// ---------- Authorization ----------

/** May the actor post/curate opportunities? */
export function canPostOpportunity(actor: Actor): boolean {
  return authorize(actor, 'opportunity:create');
}

function requirePostOpportunity(actor: Actor): void {
  if (!canPostOpportunity(actor)) throw forbidden('You may not post opportunities');
}

function requireManageOpportunity(actor: Actor): void {
  if (!authorize(actor, 'opportunity:manage')) {
    throw forbidden('You may not manage opportunities');
  }
}

// ---------- Create / update ----------

export interface CreateOpportunityInput {
  title: string;
  type?: OpportunityType;
  summary?: string | null;
  description?: string | null;
  organization?: string | null;
  country?: string | null;
  url?: string | null;
  amountMin?: number | null;
  amountMax?: number | null;
  currency?: string | null;
  opensAt?: Date | null;
  deadline?: Date | null;
  eligibility?: string | null;
  disciplines?: string[];
  funderId?: string | null;
  institutionId?: string | null;
  /** Provenance: where the listing originated (default 'manual'). */
  source?: string | null;
  sourceUrl?: string | null;
}

function cleanDisciplines(raw: string[] | undefined): string[] {
  return Array.from(
    new Set((raw ?? []).map((d) => d.trim().toLowerCase()).filter((d) => d.length > 0 && d.length <= 80)),
  ).slice(0, 25);
}

export async function createOpportunity(
  actor: Actor,
  input: CreateOpportunityInput,
  client: PrismaClient = prisma,
) {
  requirePostOpportunity(actor);
  const title = input.title?.trim();
  if (!title) throw badRequest('Opportunity title is required');
  if (input.amountMin != null && input.amountMax != null && input.amountMin > input.amountMax) {
    throw badRequest('amountMin cannot exceed amountMax');
  }

  const serial = await nextOpportunitySerial(client);
  const publicId = formatOpportunityId(serial);
  const slug = slugWithSuffix(title, String(serial));

  const opportunity = await client.opportunity.create({
    data: {
      publicId,
      slug,
      title,
      type: input.type ?? 'grant',
      summary: input.summary ?? null,
      description: input.description ?? null,
      organization: input.organization ?? null,
      country: input.country ?? null,
      url: input.url ?? null,
      amountMin: input.amountMin ?? null,
      amountMax: input.amountMax ?? null,
      currency: input.currency ?? null,
      opensAt: input.opensAt ?? null,
      deadline: input.deadline ?? null,
      eligibility: input.eligibility ?? null,
      disciplines: cleanDisciplines(input.disciplines),
      funderId: input.funderId ?? null,
      institutionId: input.institutionId ?? null,
      source: input.source ?? 'manual',
      sourceUrl: input.sourceUrl ?? null,
      postedById: actor.userId,
    },
  });

  await client.auditLog.create({
    data: {
      actorId: actor.userId,
      action: 'opportunity.create',
      entityType: 'opportunity',
      entityId: opportunity.id,
      after: { publicId, title, source: opportunity.source } as Prisma.InputJsonValue,
    },
  });

  return opportunity;
}

export async function setOpportunityStatus(
  actor: Actor,
  opportunityId: string,
  status: 'draft' | 'open' | 'closed' | 'archived',
  client: PrismaClient = prisma,
): Promise<void> {
  requireManageOpportunity(actor);
  const existing = await client.opportunity.findUnique({ where: { id: opportunityId } });
  if (!existing || existing.deletedAt) throw notFound('Opportunity not found');

  await client.$transaction([
    client.opportunity.update({ where: { id: opportunityId }, data: { status } }),
    client.auditLog.create({
      data: {
        actorId: actor.userId,
        action: 'opportunity.status',
        entityType: 'opportunity',
        entityId: opportunityId,
        after: { status } as Prisma.InputJsonValue,
      },
    }),
  ]);
}

/**
 * Auto-close opportunities whose deadline has passed (Spec §85). A soft
 * lifecycle transition only — `open` → `closed`; it never deletes, so
 * provenance, saved references, and history are preserved. Idempotent (already
 * closed/archived rows are untouched). `now` is injectable for deterministic
 * tests. Returns how many listings were closed.
 */
export async function expireOpportunities(
  now: Date = new Date(),
  client: PrismaClient = prisma,
): Promise<{ closed: number }> {
  const res = await client.opportunity.updateMany({
    // `deadline: { lt: now }` already excludes nulls (never-expiring listings).
    where: { status: 'open', deletedAt: null, deadline: { lt: now } },
    data: { status: 'closed' },
  });
  return { closed: res.count };
}

// ---------- Ingestion (§20, §85) ----------

export interface IngestResult {
  source: string;
  fetched: number;
  created: number;
  updated: number;
}

/**
 * Ingest opportunities from a legitimate source provider (Spec §20). Idempotent:
 * listings are deduped on `(source, sourceUrl)` so re-runs update in place rather
 * than duplicate. Provenance is stamped (`import:<provider>` + sourceUrl), and a
 * provider only ever touches its OWN imported records — manual listings and other
 * sources are never overwritten. Ingested rows are system-owned (no poster) and
 * published as `open`; the hourly expiry sweep closes them once past deadline.
 */
export async function ingestOpportunities(
  provider: OpportunityProvider,
  query: OpportunityQuery = {},
  client: PrismaClient = prisma,
): Promise<IngestResult> {
  const source = `import:${provider.name}`;
  const items = await provider.fetchOpportunities(query);
  let created = 0;
  let updated = 0;

  for (const item of items) {
    const sourceUrl = item.sourceUrl ?? item.url ?? null;
    const common = {
      title: item.title.trim().slice(0, 500),
      type: item.type,
      summary: item.summary ?? null,
      organization: item.organization ?? null,
      country: item.country ?? null,
      url: item.url ?? null,
      opensAt: item.opensAt ?? null,
      deadline: item.deadline ?? null,
      source,
      sourceUrl,
    };

    // Dedupe within this provider's own records only.
    const existing = sourceUrl
      ? await client.opportunity.findFirst({ where: { source, sourceUrl }, select: { id: true } })
      : null;

    if (existing) {
      await client.opportunity.update({ where: { id: existing.id }, data: common });
      updated += 1;
    } else {
      const serial = await nextOpportunitySerial(client);
      await client.opportunity.create({
        data: {
          ...common,
          publicId: formatOpportunityId(serial),
          slug: slugWithSuffix(common.title, String(serial)),
          status: 'open',
          disciplines: [],
          postedById: null,
        },
      });
      created += 1;
    }
  }

  logger.info({ source, fetched: items.length, created, updated }, 'Opportunity ingestion complete');
  return { source, fetched: items.length, created, updated };
}

/** Opportunity types that currently have at least one open, in-date listing. */
export async function listOpenOpportunityTypes(
  client: PrismaClient = prisma,
): Promise<OpportunityType[]> {
  const rows = await client.opportunity.groupBy({
    by: ['type'],
    where: {
      deletedAt: null,
      status: 'open',
      OR: [{ deadline: null }, { deadline: { gte: new Date() } }],
    },
  });
  return rows.map((r) => r.type);
}

// ---------- Public reads ----------

const listSelect = {
  id: true,
  publicId: true,
  slug: true,
  title: true,
  type: true,
  status: true,
  summary: true,
  organization: true,
  country: true,
  deadline: true,
  disciplines: true,
  amountMin: true,
  amountMax: true,
  currency: true,
  source: true,
} satisfies Prisma.OpportunitySelect;

export interface ListOpportunitiesParams {
  query?: string | undefined;
  type?: OpportunityType | undefined;
  /** Only listings still open and not past their deadline. */
  openOnly?: boolean;
  take?: number;
  skip?: number;
}

export async function listOpportunities(
  params: ListOpportunitiesParams = {},
  client: PrismaClient = prisma,
) {
  const take = Math.min(params.take ?? 20, 100);
  const skip = params.skip ?? 0;
  const where: Prisma.OpportunityWhereInput = {
    deletedAt: null,
    ...(params.type ? { type: params.type } : {}),
    ...(params.openOnly
      ? { status: 'open', OR: [{ deadline: null }, { deadline: { gte: new Date() } }] }
      : {}),
    ...(params.query
      ? {
          OR: [
            { title: { contains: params.query, mode: 'insensitive' } },
            { organization: { contains: params.query, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    client.opportunity.findMany({
      where,
      orderBy: [{ status: 'asc' }, { deadline: 'asc' }, { createdAt: 'desc' }],
      take,
      skip,
      select: listSelect,
    }),
    client.opportunity.count({ where }),
  ]);
  return { items, total };
}

export async function getOpportunityBySlug(slug: string, client: PrismaClient = prisma) {
  return client.opportunity.findFirst({
    where: { slug, deletedAt: null },
    include: {
      funder: { select: { name: true } },
      institution: { select: { name: true, slug: true } },
      postedBy: { select: { id: true } },
    },
  });
}

// ---------- Saves (researcher bookmarks) ----------

export async function saveOpportunity(
  researcherId: string,
  opportunityId: string,
  client: PrismaClient = prisma,
): Promise<void> {
  const opp = await client.opportunity.findFirst({
    where: { id: opportunityId, deletedAt: null },
    select: { id: true },
  });
  if (!opp) throw notFound('Opportunity not found');
  await client.opportunitySave.upsert({
    where: { opportunityId_researcherId: { opportunityId, researcherId } },
    create: { opportunityId, researcherId },
    update: {},
  });
}

export async function unsaveOpportunity(
  researcherId: string,
  opportunityId: string,
  client: PrismaClient = prisma,
): Promise<void> {
  await client.opportunitySave.deleteMany({ where: { opportunityId, researcherId } });
}

export async function listSavedOpportunities(
  researcherId: string,
  client: PrismaClient = prisma,
) {
  const rows = await client.opportunitySave.findMany({
    where: { researcherId, opportunity: { deletedAt: null } },
    include: { opportunity: { select: listSelect } },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map((r) => r.opportunity);
}

// ---------- Explainable matching (pure scorer + gathering) ----------

export interface OpportunitySignals {
  /** Researcher interests/expertise terms that overlap the opportunity's disciplines. */
  matchedDisciplines: string[];
  /** Opportunity is in the researcher's country. */
  sameCountry?: boolean;
  country?: string | undefined;
  /** Opportunity is posted by an institution the researcher is affiliated with. */
  sameInstitution?: boolean;
  institutionName?: string | undefined;
  /** Days until the deadline (undefined if no deadline). */
  daysToDeadline?: number | undefined;
}

export interface OpportunityScore {
  score: number; // 0..1
  reasons: string[];
}

/**
 * Score how well an opportunity fits a researcher, always producing reasons
 * (Spec §29). Pure and deterministic — unit-tested. Discipline overlap is the
 * primary signal; a match is only surfaced by the caller when it has ≥1 reason.
 */
export function scoreOpportunityMatch(signals: OpportunitySignals): OpportunityScore {
  const reasons: string[] = [];
  let score = 0;

  const matched = signals.matchedDisciplines.filter(Boolean);
  if (matched.length > 0) {
    score += Math.min(0.75, matched.length * 0.3);
    const list = matched.slice(0, 3).join(', ');
    reasons.push(
      matched.length === 1
        ? `Matches your research interest "${list}"`
        : `Matches ${matched.length} of your research interests (${list}${matched.length > 3 ? ', …' : ''})`,
    );
  }
  if (signals.sameInstitution) {
    score += 0.15;
    reasons.push(
      signals.institutionName
        ? `Posted by your institution, ${signals.institutionName}`
        : 'Posted by your institution',
    );
  }
  if (signals.sameCountry && !signals.sameInstitution) {
    score += 0.08;
    if (signals.country) reasons.push(`Open to researchers in ${signals.country}`);
  }
  if (signals.daysToDeadline != null && signals.daysToDeadline >= 0 && signals.daysToDeadline <= 30) {
    score += 0.05;
    reasons.push(
      signals.daysToDeadline === 0
        ? 'Deadline is today'
        : `Deadline in ${signals.daysToDeadline} day${signals.daysToDeadline === 1 ? '' : 's'}`,
    );
  }

  return { score: Math.min(1, score), reasons };
}

export interface OpportunityRecommendation {
  id: string;
  publicId: string;
  slug: string;
  title: string;
  type: OpportunityType;
  organization: string | null;
  deadline: Date | null;
  score: number;
  reasons: string[];
}

function daysUntil(date: Date | null): number | undefined {
  if (!date) return undefined;
  return Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

/**
 * Recommend open opportunities for a researcher, each explained. Considers only
 * live listings (open, not past deadline). Returns nothing unexplained — an
 * opportunity with no matching reason is excluded.
 */
export async function recommendOpportunities(
  researcherId: string,
  limit = 10,
  client: PrismaClient = prisma,
): Promise<OpportunityRecommendation[]> {
  const researcher = await client.researcher.findUnique({
    where: { id: researcherId },
    include: {
      interests: { select: { label: true } },
      affiliations: { select: { institutionId: true, institution: { select: { name: true } } } },
    },
  });
  if (!researcher) throw notFound('Researcher not found');

  const interestTerms = new Set(researcher.interests.map((i) => i.label.trim().toLowerCase()));
  const institutionIds = new Set(researcher.affiliations.map((a) => a.institutionId));
  const institutionNameById = new Map(
    researcher.affiliations
      .filter((a) => a.institution)
      .map((a) => [a.institutionId, a.institution!.name] as const),
  );
  const country = researcher.country?.trim() ?? null;

  const opportunities = await client.opportunity.findMany({
    where: {
      deletedAt: null,
      status: 'open',
      OR: [{ deadline: null }, { deadline: { gte: new Date() } }],
    },
    select: {
      id: true,
      publicId: true,
      slug: true,
      title: true,
      type: true,
      organization: true,
      country: true,
      deadline: true,
      disciplines: true,
      institutionId: true,
    },
    take: 200,
  });

  const recs: OpportunityRecommendation[] = [];
  for (const opp of opportunities) {
    const matched = opp.disciplines.filter((d) => interestTerms.has(d.trim().toLowerCase()));
    const sameInstitution = opp.institutionId != null && institutionIds.has(opp.institutionId);
    const sameCountry =
      !!country && !!opp.country && opp.country.trim().toLowerCase() === country.toLowerCase();

    const { score, reasons } = scoreOpportunityMatch({
      matchedDisciplines: matched,
      sameInstitution,
      institutionName: opp.institutionId ? institutionNameById.get(opp.institutionId) : undefined,
      sameCountry,
      country: country ?? undefined,
      daysToDeadline: daysUntil(opp.deadline),
    });

    // Never surface an unexplained match, and never one whose ONLY reason is a
    // near deadline — relevance must come from the researcher's own profile.
    const hasRelevance = matched.length > 0 || sameInstitution || sameCountry;
    if (reasons.length === 0 || !hasRelevance) continue;

    recs.push({
      id: opp.id,
      publicId: opp.publicId,
      slug: opp.slug,
      title: opp.title,
      type: opp.type,
      organization: opp.organization,
      deadline: opp.deadline,
      score,
      reasons,
    });
  }

  return recs.sort((a, b) => b.score - a.score).slice(0, limit);
}

/**
 * Notify registered researchers of newly-matched opportunities (§41). For every
 * researcher with a claimed account and at least one declared interest, compute
 * their top opportunity matches and create an `opportunity_match` notification
 * for any match not already notified. Idempotent: a researcher is told about a
 * given opportunity at most once. Feeds both the bell and the weekly email digest.
 */
export async function notifyOpportunityMatches(
  opts: { perResearcher?: number } = {},
  client: PrismaClient = prisma,
): Promise<{ researchers: number; created: number }> {
  const perResearcher = opts.perResearcher ?? 5;
  const researchers = await client.researcher.findMany({
    where: {
      userId: { not: null },
      deletedAt: null,
      interests: { some: {} },
    },
    select: { id: true },
  });

  let created = 0;
  for (const r of researchers) {
    const recs = await recommendOpportunities(r.id, perResearcher, client);
    for (const rec of recs) {
      const existing = await client.notification.findFirst({
        where: { recipientId: r.id, opportunityId: rec.id, type: 'opportunity_match' },
        select: { id: true },
      });
      if (existing) continue;
      await client.notification.create({
        data: {
          recipientId: r.id,
          type: 'opportunity_match',
          opportunityId: rec.id,
          actorLabel: 'ResearchTrics',
        },
      });
      created += 1;
    }
  }
  return { researchers: researchers.length, created };
}
