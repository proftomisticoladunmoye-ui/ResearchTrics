import { prisma, type PrismaClient, type Prisma } from '@researchtrics/db';
import {
  createFederationProvider,
  type ScholarlyMetadataProvider,
  type NormalizedInstitution,
} from '@researchtrics/federation';
import { notFound } from './errors';

/**
 * Institution normalization via ROR (Federation §8).
 *
 * Resolves alternate institution names/acronyms to one canonical institution
 * with a stable ROR id. Resolution only **surfaces candidates** — a link is
 * applied deliberately, never auto-merged, "when the evidence supports it" (§8).
 */

function rorProvider(injected?: ScholarlyMetadataProvider): ScholarlyMetadataProvider {
  return injected ?? createFederationProvider('ror', { ror: { baseUrl: process.env.ROR_BASE_URL } });
}

/** Search ROR for candidate matches for an institution name. */
export async function resolveInstitution(
  name: string,
  opts: { provider?: ScholarlyMetadataProvider; country?: string; limit?: number } = {},
): Promise<NormalizedInstitution[]> {
  const provider = rorProvider(opts.provider);
  if (!provider.searchInstitutions || !name.trim()) return [];
  return provider.searchInstitutions({ name: name.trim(), country: opts.country, limit: opts.limit ?? 5 });
}

/** An existing institution already linked to a ROR id (dedup, §8). */
export async function findInstitutionByRor(rorId: string, client: PrismaClient = prisma) {
  return client.institution.findFirst({ where: { rorId, deletedAt: null } });
}

/**
 * Link an institution to a ROR record: set its ROR id, canonical name, aliases,
 * website, and country from ROR. Fetches the record if only a ROR id is given.
 * Audited. If the ROR id already belongs to another institution, that is a
 * merge candidate for the review queue — this does not silently merge.
 */
export async function linkInstitutionToRor(
  institutionId: string,
  input: { rorId?: string; record?: NormalizedInstitution; provider?: ScholarlyMetadataProvider; actorId?: string },
  client: PrismaClient = prisma,
): Promise<void> {
  const institution = await client.institution.findFirst({
    where: { id: institutionId, deletedAt: null },
    select: { id: true },
  });
  if (!institution) throw notFound('Institution not found');

  let record = input.record;
  if (!record && input.rorId) {
    const provider = rorProvider(input.provider);
    if (!provider.getInstitution) throw notFound('ROR provider cannot fetch institutions');
    record = await provider.getInstitution({ ror: input.rorId });
  }
  if (!record || !record.rorId) throw notFound('No ROR record to link');

  const existing = await findInstitutionByRor(record.rorId, client);
  if (existing && existing.id !== institutionId) {
    throw notFound('That ROR id is already linked to another institution (merge required)');
  }

  await client.$transaction([
    client.institution.update({
      where: { id: institutionId },
      data: {
        rorId: record.rorId,
        name: record.name,
        aliases: Array.from(new Set([...record.aliases, ...record.acronyms])).slice(0, 30),
        website: record.website ?? undefined,
        country: record.country ?? undefined,
        type: record.types[0] ?? undefined,
      },
    }),
    client.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        action: 'institution.ror_link',
        entityType: 'institution',
        entityId: institutionId,
        after: { rorId: record.rorId, name: record.name } as Prisma.InputJsonValue,
      },
    }),
  ]);
}
