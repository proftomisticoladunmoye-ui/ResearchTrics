import { prisma, type PrismaClient, type Prisma } from '@researchtrics/db';
import { notFound } from './errors';

/**
 * Researcher profile services (Spec §8). Reads assemble the public profile;
 * writes are scoped to allowed fields and audited.
 */

const publicInclude = {
  identifiers: true,
  interests: { orderBy: { label: 'asc' } },
  orcidConnection: { select: { orcid: true, connectedAt: true } },
  affiliations: {
    include: { institution: true, department: true },
    orderBy: [{ isPrimary: 'desc' }, { startDate: 'desc' }],
  },
} satisfies Prisma.ResearcherInclude;

export type ResearcherProfile = Prisma.ResearcherGetPayload<{ include: typeof publicInclude }>;

export async function getResearcherBySlug(
  slug: string,
  client: PrismaClient = prisma,
): Promise<ResearcherProfile | null> {
  return client.researcher.findFirst({
    where: { slug, deletedAt: null },
    include: publicInclude,
  });
}

export async function getResearcherByUserId(
  userId: string,
  client: PrismaClient = prisma,
): Promise<ResearcherProfile | null> {
  return client.researcher.findFirst({
    where: { userId, deletedAt: null },
    include: publicInclude,
  });
}

export interface ProfileUpdate {
  displayName?: string;
  givenNames?: string | null;
  familyName?: string | null;
  preferredName?: string | null;
  biography?: string | null;
  country?: string | null;
  city?: string | null;
  academicRank?: string | null;
  website?: string | null;
  photoUrl?: string | null;
  researcherType?: Prisma.ResearcherUpdateInput['researcherType'];
  careerStage?: Prisma.ResearcherUpdateInput['careerStage'];
  profileVisibility?: Prisma.ResearcherUpdateInput['profileVisibility'];
}

export async function updateProfile(
  researcherId: string,
  data: ProfileUpdate,
  actorId: string,
  client: PrismaClient = prisma,
): Promise<void> {
  const existing = await client.researcher.findUnique({ where: { id: researcherId } });
  if (!existing) throw notFound('Researcher not found');

  await client.$transaction([
    client.researcher.update({ where: { id: researcherId }, data }),
    client.auditLog.create({
      data: {
        actorId,
        action: 'researcher.update',
        entityType: 'researcher',
        entityId: researcherId,
        after: data as Prisma.InputJsonValue,
      },
    }),
  ]);
}

/** Replace the researcher's interests with the provided set (deduped, trimmed). */
export async function setInterests(
  researcherId: string,
  labels: string[],
  client: PrismaClient = prisma,
): Promise<void> {
  const clean = Array.from(
    new Set(labels.map((l) => l.trim()).filter((l) => l.length > 0 && l.length <= 80)),
  ).slice(0, 30);

  await client.$transaction([
    client.researchInterest.deleteMany({ where: { researcherId } }),
    client.researchInterest.createMany({
      data: clean.map((label) => ({ researcherId, label })),
    }),
  ]);
}

export interface ListResearchersParams {
  query?: string | undefined;
  take?: number;
  skip?: number;
}

export async function listResearchers(
  params: ListResearchersParams = {},
  client: PrismaClient = prisma,
): Promise<{ items: Array<Pick<ResearcherProfile, 'id' | 'displayName' | 'slug' | 'researchtricsId' | 'country' | 'academicRank' | 'verificationLevel'>>; total: number }> {
  const take = Math.min(params.take ?? 20, 100);
  const skip = params.skip ?? 0;
  const where: Prisma.ResearcherWhereInput = {
    deletedAt: null,
    profileVisibility: 'public',
    ...(params.query
      ? {
          OR: [
            { displayName: { contains: params.query, mode: 'insensitive' } },
            { familyName: { contains: params.query, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    client.researcher.findMany({
      where,
      orderBy: { displayName: 'asc' },
      take,
      skip,
      select: {
        id: true,
        displayName: true,
        slug: true,
        researchtricsId: true,
        country: true,
        academicRank: true,
        verificationLevel: true,
      },
    }),
    client.researcher.count({ where }),
  ]);

  return { items, total };
}
