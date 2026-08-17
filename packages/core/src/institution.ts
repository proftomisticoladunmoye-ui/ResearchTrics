import { prisma, type PrismaClient, type Prisma } from '@researchtrics/db';
import { slugWithSuffix, slugify } from './id';
import { badRequest } from './errors';

/**
 * Institution & affiliation services (Spec §7, §26). Affiliations are
 * time-bounded M:N links; verified affiliations are never overwritten blindly.
 */

export async function listInstitutions(
  params: { query?: string | undefined; take?: number; skip?: number } = {},
  client: PrismaClient = prisma,
) {
  const take = Math.min(params.take ?? 20, 100);
  const skip = params.skip ?? 0;
  const where: Prisma.InstitutionWhereInput = {
    deletedAt: null,
    ...(params.query ? { name: { contains: params.query, mode: 'insensitive' } } : {}),
  };
  const [items, total] = await Promise.all([
    client.institution.findMany({ where, orderBy: { name: 'asc' }, take, skip }),
    client.institution.count({ where }),
  ]);
  return { items, total };
}

export async function getInstitutionBySlug(slug: string, client: PrismaClient = prisma) {
  return client.institution.findFirst({
    where: { slug, deletedAt: null },
    include: {
      departments: { orderBy: { name: 'asc' } },
      affiliations: {
        where: { researcher: { deletedAt: null, profileVisibility: 'public' } },
        include: {
          researcher: {
            select: { id: true, displayName: true, slug: true, academicRank: true },
          },
        },
        take: 100,
      },
    },
  });
}

/** Find an institution by name (case-insensitive) or create it. Used by imports. */
export async function findOrCreateInstitutionByName(
  name: string,
  extra: { country?: string | null; rorId?: string | null } = {},
  client: PrismaClient = prisma,
) {
  const trimmed = name.trim();
  const existing = await client.institution.findFirst({
    where: { name: { equals: trimmed, mode: 'insensitive' }, deletedAt: null },
  });
  if (existing) return existing;

  let slug = slugify(trimmed);
  if (await client.institution.findUnique({ where: { slug } })) {
    slug = slugWithSuffix(trimmed, Math.random().toString(36).slice(2, 7));
  }
  return client.institution.create({
    data: {
      name: trimmed,
      slug,
      country: extra.country ?? null,
      rorId: extra.rorId ?? null,
    },
  });
}

export interface AddAffiliationInput {
  researcherId: string;
  institutionId: string;
  departmentId?: string | null;
  role?: Prisma.AffiliationCreateInput['role'];
  isPrimary?: boolean;
  startDate?: Date | null;
  endDate?: Date | null;
  verified?: boolean;
}

export async function addAffiliation(
  input: AddAffiliationInput,
  client: PrismaClient = prisma,
) {
  // If this is marked primary, demote any existing primary for the researcher.
  return client.$transaction(async (tx) => {
    if (input.isPrimary) {
      await tx.affiliation.updateMany({
        where: { researcherId: input.researcherId, isPrimary: true },
        data: { isPrimary: false },
      });
    }
    return tx.affiliation.create({
      data: {
        researcherId: input.researcherId,
        institutionId: input.institutionId,
        departmentId: input.departmentId ?? null,
        role: input.role ?? 'faculty',
        isPrimary: input.isPrimary ?? false,
        startDate: input.startDate ?? null,
        endDate: input.endDate ?? null,
        verified: input.verified ?? false,
      },
    });
  });
}

export async function removeAffiliation(
  affiliationId: string,
  researcherId: string,
  client: PrismaClient = prisma,
): Promise<void> {
  await client.affiliation.deleteMany({ where: { id: affiliationId, researcherId } });
}

export interface AddResearcherAffiliationInput {
  researcherId: string;
  institutionName: string;
  country?: string | null;
  role?: Prisma.AffiliationCreateInput['role'];
  isPrimary?: boolean;
}

/**
 * Add an affiliation for a researcher by institution NAME — resolving (or
 * creating) the canonical institution first, so a researcher can set their
 * university from the dashboard without knowing an internal id (§7). Newly
 * self-declared affiliations are unverified until confirmed by the institution.
 */
export async function addResearcherAffiliation(
  input: AddResearcherAffiliationInput,
  client: PrismaClient = prisma,
) {
  const name = input.institutionName.trim();
  if (name.length < 2) throw badRequest('An institution name is required');
  const institution = await findOrCreateInstitutionByName(name, { country: input.country }, client);
  return addAffiliation(
    {
      researcherId: input.researcherId,
      institutionId: institution.id,
      role: input.role,
      isPrimary: input.isPrimary ?? false,
      verified: false,
    },
    client,
  );
}
