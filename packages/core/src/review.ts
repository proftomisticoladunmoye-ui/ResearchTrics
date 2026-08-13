import { prisma, type PrismaClient, type Prisma, type ProfileStatus } from '@researchtrics/db';
import { badRequest, notFound } from './errors';

/**
 * Identity review & merge (Discovery Engine §24, §57) plus discovery growth
 * metrics (§40) and the discovery query behind the API (§51).
 *
 * Merges are evidence-driven and audited: a duplicate's scholarly records move
 * to the canonical profile and the duplicate is marked `merged` (never hard
 * deleted). Nothing is auto-merged — an admin (or the researcher) confirms.
 */

// ---------- Duplicate detection / review queue (§57) ----------

export interface DuplicateGroup {
  key: string;
  reason: string;
  researchers: Array<{
    id: string;
    slug: string;
    displayName: string;
    profileStatus: string;
    identityConfidence: number | null;
  }>;
}

/**
 * Surface likely-duplicate profiles for human review: profiles that share the
 * same display name where at least one is still unclaimed. This only *surfaces*
 * candidates — nothing is auto-merged, because name alone is never sufficient
 * evidence of identity (§25). An admin confirms with the full evidence.
 */
export async function listReviewQueue(
  limit = 50,
  client: PrismaClient = prisma,
): Promise<DuplicateGroup[]> {
  const researchers = await client.researcher.findMany({
    where: { deletedAt: null },
    select: { id: true, slug: true, displayName: true, profileStatus: true, identityConfidence: true },
  });

  const byName = new Map<string, DuplicateGroup['researchers']>();
  for (const r of researchers) {
    const key = r.displayName.trim().toLowerCase().replace(/\s+/g, ' ');
    const list = byName.get(key) ?? [];
    list.push(r);
    byName.set(key, list);
  }

  const groups: DuplicateGroup[] = [];
  for (const [key, group] of byName) {
    const hasUnclaimed = group.some((r) =>
      ['discovered', 'unclaimed', 'claim_pending'].includes(r.profileStatus),
    );
    if (group.length > 1 && hasUnclaimed) {
      groups.push({ key, reason: `Same name — ${group.length} profiles need review`, researchers: group });
    }
  }
  return groups.slice(0, limit);
}

// ---------- Merge (§24) ----------

/**
 * Merge `duplicateId` into `canonicalId`: move scholarly records and mark the
 * duplicate `merged`. Handles the two unique-constrained relations (identifiers,
 * publication claims) explicitly; the rest move wholesale. Intended for
 * discovered/unclaimed duplicates (which carry no groups/collab records).
 */
export async function mergeResearchers(
  canonicalId: string,
  duplicateId: string,
  actorId: string | undefined,
  client: PrismaClient = prisma,
): Promise<void> {
  if (canonicalId === duplicateId) throw badRequest('Cannot merge a profile into itself');
  const [canonical, duplicate] = await Promise.all([
    client.researcher.findUnique({ where: { id: canonicalId }, select: { id: true, deletedAt: true } }),
    client.researcher.findUnique({ where: { id: duplicateId }, select: { id: true, deletedAt: true } }),
  ]);
  if (!canonical || canonical.deletedAt) throw notFound('Canonical profile not found');
  if (!duplicate || duplicate.deletedAt) throw notFound('Duplicate profile not found');

  await client.$transaction(async (tx) => {
    // Identifiers — unique on [scheme, value]: move those the canonical lacks,
    // drop the rest.
    const canonicalIds = await tx.researcherIdentifier.findMany({
      where: { researcherId: canonicalId },
      select: { scheme: true, value: true },
    });
    const have = new Set(canonicalIds.map((i) => `${i.scheme}:${i.value}`));
    const dupIds = await tx.researcherIdentifier.findMany({ where: { researcherId: duplicateId } });
    for (const id of dupIds) {
      if (have.has(`${id.scheme}:${id.value}`)) {
        await tx.researcherIdentifier.delete({ where: { id: id.id } });
      } else {
        await tx.researcherIdentifier.update({ where: { id: id.id }, data: { researcherId: canonicalId } });
      }
    }

    // Publication claims — unique on [researcherId, publicationId].
    const canonClaims = await tx.researcherPublicationClaim.findMany({
      where: { researcherId: canonicalId },
      select: { publicationId: true },
    });
    const haveClaim = new Set(canonClaims.map((c) => c.publicationId));
    const dupClaims = await tx.researcherPublicationClaim.findMany({ where: { researcherId: duplicateId } });
    for (const c of dupClaims) {
      if (haveClaim.has(c.publicationId)) await tx.researcherPublicationClaim.delete({ where: { id: c.id } });
      else await tx.researcherPublicationClaim.update({ where: { id: c.id }, data: { researcherId: canonicalId } });
    }

    // Interests — dedupe by label.
    const canonInterests = await tx.researchInterest.findMany({
      where: { researcherId: canonicalId },
      select: { label: true },
    });
    const haveLabel = new Set(canonInterests.map((i) => i.label.toLowerCase()));
    const dupInterests = await tx.researchInterest.findMany({ where: { researcherId: duplicateId } });
    for (const i of dupInterests) {
      if (haveLabel.has(i.label.toLowerCase())) await tx.researchInterest.delete({ where: { id: i.id } });
      else await tx.researchInterest.update({ where: { id: i.id }, data: { researcherId: canonicalId } });
    }

    // Unconstrained relations move wholesale.
    await tx.publicationAuthor.updateMany({ where: { researcherId: duplicateId }, data: { researcherId: canonicalId } });
    await tx.researcherNameVariant.updateMany({ where: { researcherId: duplicateId }, data: { researcherId: canonicalId } });
    await tx.researcherSource.updateMany({ where: { researcherId: duplicateId }, data: { researcherId: canonicalId } });
    await tx.affiliation.updateMany({ where: { researcherId: duplicateId }, data: { researcherId: canonicalId } });

    await tx.researcher.update({
      where: { id: duplicateId },
      data: { profileStatus: 'merged', deletedAt: new Date(), userId: null },
    });
    await tx.auditLog.create({
      data: {
        actorId: actorId ?? null,
        action: 'researcher.merge',
        entityType: 'researcher',
        entityId: canonicalId,
        after: { mergedFrom: duplicateId } as Prisma.InputJsonValue,
      },
    });
  });
}

// ---------- Growth metrics (§40) ----------

export interface DiscoveryGrowthMetrics {
  byStatus: Record<string, number>;
  bySource: Array<{ source: string; count: number }>;
  totalDiscovered: number;
  claimed: number;
  verified: number;
  suppressed: number;
}

export async function discoveryGrowthMetrics(
  client: PrismaClient = prisma,
): Promise<DiscoveryGrowthMetrics> {
  const statuses = await client.researcher.groupBy({
    by: ['profileStatus'],
    _count: { _all: true },
  });
  const byStatus: Record<string, number> = {};
  for (const s of statuses) byStatus[s.profileStatus] = s._count._all;

  const sources = await client.researcher.groupBy({
    by: ['discoverySource'],
    where: { discoverySource: { not: null } },
    _count: { _all: true },
  });
  const bySource = sources
    .map((s) => ({ source: s.discoverySource ?? 'unknown', count: s._count._all }))
    .sort((a, b) => b.count - a.count);

  const discoveredStatuses: ProfileStatus[] = ['discovered', 'unclaimed', 'claim_pending'];
  const totalDiscovered = discoveredStatuses.reduce((sum, s) => sum + (byStatus[s] ?? 0), 0);

  return {
    byStatus,
    bySource,
    totalDiscovered,
    claimed: byStatus['claimed'] ?? 0,
    verified: byStatus['verified'] ?? 0,
    suppressed: byStatus['suppressed'] ?? 0,
  };
}

// ---------- Discovery query (behind the API, §51) ----------

export interface DiscoveryQueryFilters {
  status?: ProfileStatus | undefined;
  source?: string | undefined;
  country?: string | undefined;
  minConfidence?: number | undefined;
  take?: number;
  skip?: number;
}

export async function queryDiscoveredResearchers(
  filters: DiscoveryQueryFilters = {},
  client: PrismaClient = prisma,
) {
  const take = Math.min(filters.take ?? 25, 100);
  const skip = filters.skip ?? 0;
  const where: Prisma.ResearcherWhereInput = {
    deletedAt: null,
    profileStatus: filters.status ?? { in: ['discovered', 'unclaimed', 'claim_pending'] },
    ...(filters.source ? { discoverySource: filters.source } : {}),
    ...(filters.country ? { country: filters.country } : {}),
    ...(filters.minConfidence != null ? { identityConfidence: { gte: filters.minConfidence } } : {}),
  };

  const [items, total] = await Promise.all([
    client.researcher.findMany({
      where,
      orderBy: [{ identityConfidence: 'desc' }, { createdAt: 'desc' }],
      take,
      skip,
      select: {
        researchtricsId: true,
        slug: true,
        displayName: true,
        country: true,
        profileStatus: true,
        identityConfidence: true,
        discoverySource: true,
        identifiers: { select: { scheme: true, value: true } },
      },
    }),
    client.researcher.count({ where }),
  ]);
  return { items, total, take, skip };
}
