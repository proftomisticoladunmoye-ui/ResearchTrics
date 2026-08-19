import { prisma, type PrismaClient, type Prisma } from '@researchtrics/db';
import { slugWithSuffix } from './id';

/** Research groups (Spec §27). A group has a lead, members, interests, and a public profile. */

export interface CreateGroupInput {
  name: string;
  description?: string | null;
  interests?: string | null;
  institutionId?: string | null;
}

export async function createGroup(
  leadResearcherId: string,
  input: CreateGroupInput,
  client: PrismaClient = prisma,
): Promise<{ id: string; slug: string }> {
  const slug = slugWithSuffix(input.name, Math.random().toString(36).slice(2, 7));
  return client.$transaction(async (tx) => {
    const group = await tx.researchGroup.create({
      data: {
        slug,
        name: input.name,
        description: input.description ?? null,
        interests: input.interests ?? null,
        institutionId: input.institutionId ?? null,
        leadResearcherId,
      },
    });
    await tx.researchGroupMember.create({
      data: { groupId: group.id, researcherId: leadResearcherId, role: 'Lead' },
    });
    return { id: group.id, slug: group.slug };
  });
}

const groupInclude = {
  institution: { select: { slug: true, name: true } },
  lead: { select: { slug: true, displayName: true } },
  members: {
    include: { researcher: { select: { slug: true, displayName: true, academicRank: true, photoUrl: true } } },
    orderBy: { joinedAt: 'asc' },
  },
} satisfies Prisma.ResearchGroupInclude;

export type GroupDetail = Prisma.ResearchGroupGetPayload<{ include: typeof groupInclude }>;

export async function getGroupBySlug(slug: string, client: PrismaClient = prisma) {
  return client.researchGroup.findFirst({ where: { slug, deletedAt: null }, include: groupInclude });
}

export async function listGroups(
  params: { query?: string | undefined; take?: number } = {},
  client: PrismaClient = prisma,
) {
  const take = Math.min(params.take ?? 40, 100);
  const where: Prisma.ResearchGroupWhereInput = {
    deletedAt: null,
    ...(params.query ? { name: { contains: params.query, mode: 'insensitive' } } : {}),
  };
  const [items, total] = await Promise.all([
    client.researchGroup.findMany({
      where,
      orderBy: { name: 'asc' },
      take,
      include: { _count: { select: { members: true } }, institution: { select: { name: true } } },
    }),
    client.researchGroup.count({ where }),
  ]);
  return { items, total };
}

export async function addGroupMember(
  groupId: string,
  researcherId: string,
  role: string | null,
  client: PrismaClient = prisma,
): Promise<void> {
  await client.researchGroupMember.upsert({
    where: { groupId_researcherId: { groupId, researcherId } },
    update: { role },
    create: { groupId, researcherId, role: role ?? 'Member' },
  });
}
