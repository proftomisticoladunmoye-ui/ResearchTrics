import {
  prisma,
  type PrismaClient,
  type Prisma,
  nextResearcherSerial,
} from '@researchtrics/db';
import type { DiscoveredResearcher } from '@researchtrics/discovery';
import { formatResearchtricsId, slugWithSuffix } from './id';
import { logger } from './logger';

/**
 * Researcher discovery service (Discovery Engine §3, §4, §35, §36, §68).
 *
 * Turns a discovered candidate into a PROVISIONAL, unclaimed researcher profile
 * — never a verified account. Provenance is recorded per source, suppressed
 * profiles are never recreated, and existing identities are reused rather than
 * duplicated. Ownership is only ever established later, by the researcher
 * (§68).
 */

/** Normalized suppression key: lowercased name (+ country), whitespace-collapsed. */
export function nameKeyFor(name: string, country?: string | null): string {
  const base = name.trim().toLowerCase().replace(/\s+/g, ' ');
  return country ? `${base}|${country.trim().toLowerCase()}` : base;
}

/** Has this profile been suppressed / opted out (Discovery Engine §35)? */
export async function isSuppressed(
  candidate: { orcid?: string | undefined; fullName: string; country?: string | undefined },
  client: PrismaClient = prisma,
): Promise<boolean> {
  const nameKey = nameKeyFor(candidate.fullName, candidate.country ?? null);
  const hit = await client.profileSuppression.findFirst({
    where: {
      OR: [
        ...(candidate.orcid ? [{ orcid: candidate.orcid }] : []),
        { nameKey },
      ],
    },
    select: { id: true },
  });
  return hit != null;
}

/** Record an opt-out so future syncs never recreate the profile (§35). */
export async function recordSuppression(
  input: { orcid?: string | null; name: string; country?: string | null; reason?: string | null; actorId?: string | null },
  client: PrismaClient = prisma,
): Promise<void> {
  await client.profileSuppression.create({
    data: {
      orcid: input.orcid ?? null,
      nameKey: nameKeyFor(input.name, input.country ?? null),
      reason: input.reason ?? null,
      createdBy: input.actorId ?? null,
    },
  });
}

/**
 * Find an existing researcher that a candidate clearly refers to, using strong
 * identifiers only (ORCID, OpenAlex author id). Name is never used alone here —
 * fuzzy identity resolution against the whole DB is the review queue's job.
 */
async function findExistingByIdentifier(
  candidate: DiscoveredResearcher,
  client: PrismaClient,
): Promise<string | null> {
  const ors: Prisma.ResearcherIdentifierWhereInput[] = [];
  if (candidate.orcid) ors.push({ scheme: 'orcid', value: candidate.orcid });
  if (candidate.openalexAuthorId) ors.push({ scheme: 'openalex', value: candidate.openalexAuthorId });
  if (ors.length === 0) return null;
  const match = await client.researcherIdentifier.findFirst({
    where: { OR: ors },
    select: { researcherId: true },
  });
  return match?.researcherId ?? null;
}

export interface ProvisionalResult {
  researcherId: string;
  researchtricsId: string;
  slug: string;
  status: 'created' | 'exists' | 'suppressed';
}

/**
 * Create (or reuse) a provisional UNCLAIMED researcher profile from a discovered
 * candidate. Records per-field provenance (§36). Idempotent on strong
 * identifiers, and refuses to recreate a suppressed profile (§35).
 */
export async function createProvisionalResearcher(
  candidate: DiscoveredResearcher,
  client: PrismaClient = prisma,
): Promise<ProvisionalResult> {
  if (await isSuppressed(candidate, client)) {
    return { researcherId: '', researchtricsId: '', slug: '', status: 'suppressed' };
  }

  const existingId = await findExistingByIdentifier(candidate, client);
  if (existingId) {
    const existing = await client.researcher.findUniqueOrThrow({
      where: { id: existingId },
      select: { researchtricsId: true, slug: true },
    });
    return {
      researcherId: existingId,
      researchtricsId: existing.researchtricsId,
      slug: existing.slug,
      status: 'exists',
    };
  }

  const serial = await nextResearcherSerial(client);
  const researchtricsId = formatResearchtricsId(serial);
  const slug = slugWithSuffix(candidate.fullName, String(serial));
  const source = candidate.provenance.source;
  const confidence = candidate.provenance.confidence ?? null;

  const interests = Array.from(
    new Set(candidate.topics.map((t) => t.trim().toLowerCase()).filter(Boolean)),
  ).slice(0, 30);
  const variants = Array.from(new Set(candidate.nameVariants.map((n) => n.trim()).filter(Boolean)));

  const researcher = await client.researcher.create({
    data: {
      researchtricsId,
      slug,
      displayName: candidate.fullName,
      country: candidate.country ?? null,
      // Provisional identity — publicly claimable, never a verified account (§68).
      profileStatus: 'unclaimed',
      verificationLevel: 0,
      identityConfidence: confidence,
      discoverySource: source,
      interests: { create: interests.map((label) => ({ label })) },
      nameVariants: { create: variants.map((name) => ({ name, source })) },
      identifiers: {
        create: [
          ...(candidate.orcid ? [{ scheme: 'orcid' as const, value: candidate.orcid, verified: false }] : []),
          ...(candidate.openalexAuthorId
            ? [{ scheme: 'openalex' as const, value: candidate.openalexAuthorId, verified: false }]
            : []),
        ],
      },
      discoverySources: {
        create: buildProvenanceRows(candidate),
      },
    },
    select: { id: true },
  });

  await client.auditLog.create({
    data: {
      action: 'researcher.discovered',
      entityType: 'researcher',
      entityId: researcher.id,
      after: { source, researchtricsId, confidence } as Prisma.InputJsonValue,
    },
  });

  logger.info({ researchtricsId, source }, 'Discovered provisional researcher');
  return { researcherId: researcher.id, researchtricsId, slug, status: 'created' };
}

/** One provenance row per discovered field (Discovery Engine §5, §36). */
function buildProvenanceRows(candidate: DiscoveredResearcher) {
  const p = candidate.provenance;
  const base = {
    source: p.source,
    sourceId: p.sourceId ?? null,
    sourceUrl: p.sourceUrl ?? null,
    confidence: p.confidence ?? null,
  };
  const rows: Array<Record<string, unknown>> = [{ ...base, field: 'name' }];
  if (candidate.institution) rows.push({ ...base, field: 'institution' });
  if (candidate.orcid) rows.push({ ...base, field: 'orcid' });
  if (candidate.topics.length > 0) rows.push({ ...base, field: 'topics' });
  return rows as Prisma.ResearcherSourceCreateWithoutResearcherInput[];
}

/** Public read for an unclaimed/claimed discovered profile with its provenance. */
export async function getDiscoveredProfileBySlug(slug: string, client: PrismaClient = prisma) {
  return client.researcher.findFirst({
    where: { slug, deletedAt: null },
    include: {
      interests: { orderBy: { label: 'asc' } },
      identifiers: true,
      nameVariants: true,
      discoverySources: { orderBy: { retrievedAt: 'desc' } },
    },
  });
}
