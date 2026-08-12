import { prisma, type PrismaClient, type Prisma } from '@researchtrics/db';
import { type Actor, authorize } from './rbac';
import { forbidden, notFound } from './errors';

/**
 * Institutional platform (Spec §26, §49, §85).
 *
 * An institution admin sees an institution-scoped view of *real* records —
 * every figure is a live aggregate over affiliated researchers, never a
 * fabricated or projected number. All admin actions are tenant-isolated
 * (an admin scoped to institution A can never act on institution B) and
 * audited; verified affiliations are confirmed, never overwritten blindly.
 */

// ---------- Authorization (tenant isolation, Spec §49) ----------

/** Does the actor hold institution-management rights for THIS institution? */
export function canManageInstitution(actor: Actor, institutionId: string): boolean {
  return authorize(actor, 'institution:manage', { tenantInstitutionId: institutionId });
}

/** Throw FORBIDDEN unless the actor may manage this institution. */
export function requireInstitutionManage(actor: Actor, institutionId: string): void {
  if (!canManageInstitution(actor, institutionId)) {
    throw forbidden('You do not administer this institution');
  }
}

/** Institution ids the actor may administer (from institution-scoped roles). */
export function administeredInstitutionIds(actor: Actor): string[] {
  const ids = new Set<string>();
  for (const r of actor.roles) {
    if (r.scopeType === 'institution' && r.scopeId && canManageInstitution(actor, r.scopeId)) {
      ids.add(r.scopeId);
    }
  }
  return Array.from(ids);
}

// ---------- Pure aggregation helper (tested) ----------

export interface ScoreSummary {
  count: number;
  average: number | null;
  median: number | null;
}

/** Summarize a set of numeric scores. Empty input yields null averages, never 0. */
export function summarizeScores(values: number[]): ScoreSummary {
  const clean = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  const count = clean.length;
  if (count === 0) return { count: 0, average: null, median: null };
  const sum = clean.reduce((s, v) => s + v, 0);
  const mid = Math.floor(count / 2);
  const median = count % 2 === 0 ? (clean[mid - 1]! + clean[mid]!) / 2 : clean[mid]!;
  return {
    count,
    average: Math.round((sum / count) * 10) / 10,
    median: Math.round(median * 10) / 10,
  };
}

// ---------- Institution overview (grounded aggregates) ----------

export interface InstitutionOverview {
  institution: { id: string; name: string; slug: string; country: string | null };
  researcherCount: number;
  verifiedAffiliationCount: number;
  pendingAffiliationCount: number;
  departmentCount: number;
  publicationCount: number;
  citationTotal: number;
  openAccessCount: number;
  outputs: { projects: number; datasets: number; instruments: number; software: number };
  /** Aggregate RVM across affiliated researchers who have a score — prototype, pending validation. */
  rvm: ScoreSummary & { coverage: number };
  topResearchers: Array<{
    id: string;
    displayName: string;
    slug: string;
    publicationCount: number;
  }>;
}

/** Distinct, non-deleted researcher ids affiliated with an institution. */
async function affiliatedResearcherIds(
  institutionId: string,
  client: PrismaClient,
): Promise<string[]> {
  const rows = await client.affiliation.findMany({
    where: { institutionId, researcher: { deletedAt: null } },
    select: { researcherId: true },
    distinct: ['researcherId'],
  });
  return rows.map((r) => r.researcherId);
}

export async function getInstitutionOverview(
  institutionId: string,
  client: PrismaClient = prisma,
): Promise<InstitutionOverview> {
  const institution = await client.institution.findFirst({
    where: { id: institutionId, deletedAt: null },
    select: { id: true, name: true, slug: true, country: true },
  });
  if (!institution) throw notFound('Institution not found');

  const researcherIds = await affiliatedResearcherIds(institutionId, client);
  const inSet: Prisma.StringFilter = { in: researcherIds };

  const [
    verifiedAffiliationCount,
    pendingAffiliationCount,
    departmentCount,
    publications,
    projects,
    datasets,
    instruments,
    software,
    rvmScores,
  ] = await Promise.all([
    client.affiliation.count({ where: { institutionId, verified: true } }),
    client.affiliation.count({ where: { institutionId, verified: false } }),
    client.department.count({ where: { institutionId } }),
    researcherIds.length
      ? client.publication.findMany({
          where: { deletedAt: null, authors: { some: { researcherId: inSet } } },
          select: { openAccess: true, citationCounts: { select: { count: true } } },
        })
      : Promise.resolve([]),
    client.project.count({
      where: {
        deletedAt: null,
        OR: [
          { institutionId },
          ...(researcherIds.length ? [{ piResearcherId: inSet }] : []),
        ],
      },
    }),
    researcherIds.length
      ? client.dataset.count({ where: { deletedAt: null, creatorResearcherId: inSet } })
      : Promise.resolve(0),
    researcherIds.length
      ? client.instrument.count({ where: { deletedAt: null, authorResearcherId: inSet } })
      : Promise.resolve(0),
    researcherIds.length
      ? client.software.count({ where: { deletedAt: null, authorResearcherId: inSet } })
      : Promise.resolve(0),
    researcherIds.length ? latestRvmByResearcher(researcherIds, client) : Promise.resolve([]),
  ]);

  const citationTotal = publications.reduce(
    (sum, p) => sum + Math.max(0, ...p.citationCounts.map((c) => c.count), 0),
    0,
  );
  const openAccessCount = publications.filter((p) => p.openAccess).length;

  const rvmSummary = summarizeScores(rvmScores);
  const coverage = researcherIds.length
    ? Math.round((rvmScores.length / researcherIds.length) * 100)
    : 0;

  const topResearchers = await topResearchersByPublications(researcherIds, client);

  return {
    institution,
    researcherCount: researcherIds.length,
    verifiedAffiliationCount,
    pendingAffiliationCount,
    departmentCount,
    publicationCount: publications.length,
    citationTotal,
    openAccessCount,
    outputs: { projects, datasets, instruments, software },
    rvm: { ...rvmSummary, coverage },
    topResearchers,
  };
}

/** Latest RVM overall per researcher (only those with a snapshot). */
async function latestRvmByResearcher(
  researcherIds: string[],
  client: PrismaClient,
): Promise<number[]> {
  const rows = await client.rvmScore.findMany({
    where: { subjectType: 'researcher', subjectId: { in: researcherIds } },
    orderBy: { calculatedAt: 'desc' },
    select: { subjectId: true, overall: true },
  });
  const latest = new Map<string, number>();
  for (const row of rows) if (!latest.has(row.subjectId)) latest.set(row.subjectId, row.overall);
  return Array.from(latest.values());
}

async function topResearchersByPublications(
  researcherIds: string[],
  client: PrismaClient,
): Promise<InstitutionOverview['topResearchers']> {
  if (researcherIds.length === 0) return [];
  const researchers = await client.researcher.findMany({
    where: { id: { in: researcherIds }, deletedAt: null, profileVisibility: 'public' },
    select: {
      id: true,
      displayName: true,
      slug: true,
      _count: { select: { authorships: true } },
    },
  });
  return researchers
    .map((r) => ({
      id: r.id,
      displayName: r.displayName,
      slug: r.slug,
      publicationCount: r._count.authorships,
    }))
    .sort((a, b) => b.publicationCount - a.publicationCount || a.displayName.localeCompare(b.displayName))
    .slice(0, 10);
}

// ---------- Members roster ----------

export interface InstitutionMember {
  affiliationId: string;
  researcherId: string;
  displayName: string;
  slug: string;
  academicRank: string | null;
  role: string;
  isPrimary: boolean;
  verified: boolean;
  publicationCount: number;
}

export async function listInstitutionMembers(
  institutionId: string,
  client: PrismaClient = prisma,
): Promise<InstitutionMember[]> {
  const affiliations = await client.affiliation.findMany({
    where: { institutionId, researcher: { deletedAt: null } },
    include: {
      researcher: {
        select: {
          id: true,
          displayName: true,
          slug: true,
          academicRank: true,
          _count: { select: { authorships: true } },
        },
      },
    },
    orderBy: [{ verified: 'desc' }, { isPrimary: 'desc' }],
  });

  return affiliations.map((a) => ({
    affiliationId: a.id,
    researcherId: a.researcherId,
    displayName: a.researcher.displayName,
    slug: a.researcher.slug,
    academicRank: a.researcher.academicRank,
    role: a.role,
    isPrimary: a.isPrimary,
    verified: a.verified,
    publicationCount: a.researcher._count.authorships,
  }));
}

/** Affiliations awaiting institutional confirmation (the admin's verification queue). */
export async function listPendingAffiliations(
  institutionId: string,
  client: PrismaClient = prisma,
): Promise<InstitutionMember[]> {
  return (await listInstitutionMembers(institutionId, client)).filter((m) => !m.verified);
}

// ---------- Admin actions (RBAC-guarded, audited, Spec §85) ----------

async function loadAffiliation(affiliationId: string, client: PrismaClient) {
  const affiliation = await client.affiliation.findUnique({
    where: { id: affiliationId },
    select: { id: true, institutionId: true, researcherId: true, verified: true },
  });
  if (!affiliation) throw notFound('Affiliation not found');
  return affiliation;
}

/**
 * Confirm a claimed affiliation. Tenant-isolated to the affiliation's own
 * institution, audited, and — since an institution can vouch for identity —
 * it raises the researcher's verification level to at least "institution"
 * (level 2, Spec §38) without ever lowering an already-higher level.
 */
export async function verifyAffiliation(
  actor: Actor,
  affiliationId: string,
  client: PrismaClient = prisma,
): Promise<void> {
  const affiliation = await loadAffiliation(affiliationId, client);
  requireInstitutionManage(actor, affiliation.institutionId);
  if (affiliation.verified) return;

  await client.$transaction(async (tx) => {
    await tx.affiliation.update({ where: { id: affiliation.id }, data: { verified: true } });
    await tx.researcher.updateMany({
      where: { id: affiliation.researcherId, verificationLevel: { lt: 2 } },
      data: { verificationLevel: 2 },
    });
    await tx.auditLog.create({
      data: {
        actorId: actor.userId,
        action: 'affiliation.verify',
        entityType: 'affiliation',
        entityId: affiliation.id,
        after: { verified: true, institutionId: affiliation.institutionId } as Prisma.InputJsonValue,
      },
    });
  });
}

/** Revoke a confirmation (never deletes the affiliation record). Audited. */
export async function revokeAffiliationVerification(
  actor: Actor,
  affiliationId: string,
  client: PrismaClient = prisma,
): Promise<void> {
  const affiliation = await loadAffiliation(affiliationId, client);
  requireInstitutionManage(actor, affiliation.institutionId);
  if (!affiliation.verified) return;

  await client.$transaction(async (tx) => {
    await tx.affiliation.update({ where: { id: affiliation.id }, data: { verified: false } });
    await tx.auditLog.create({
      data: {
        actorId: actor.userId,
        action: 'affiliation.revoke',
        entityType: 'affiliation',
        entityId: affiliation.id,
        after: { verified: false, institutionId: affiliation.institutionId } as Prisma.InputJsonValue,
      },
    });
  });
}
