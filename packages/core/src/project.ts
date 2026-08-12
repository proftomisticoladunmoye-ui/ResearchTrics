import {
  prisma,
  nextOutputSerial,
  type PrismaClient,
  type Prisma,
  type ProjectStatus,
} from '@researchtrics/db';
import { formatOutputId, slugWithSuffix } from './id';
import { notFound } from './errors';

/**
 * Research project services (Spec §19). A project is the hub that connects
 * outputs, datasets, instruments, software, funding and people.
 */

export interface CreateProjectInput {
  title: string;
  description?: string | null;
  objectives?: string | null;
  researchQuestions?: string | null;
  methodology?: string | null;
  status?: ProjectStatus;
  startDate?: Date | null;
  endDate?: Date | null;
  institutionId?: string | null;
}

export async function createProject(
  piResearcherId: string,
  input: CreateProjectInput,
  actorId: string,
  client: PrismaClient = prisma,
): Promise<{ id: string; slug: string; publicId: string }> {
  const serial = await nextOutputSerial('project', client);
  const publicId = formatOutputId('project', serial);
  const slug = slugWithSuffix(input.title, String(serial));

  return client.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        publicId,
        slug,
        title: input.title,
        description: input.description ?? null,
        objectives: input.objectives ?? null,
        researchQuestions: input.researchQuestions ?? null,
        methodology: input.methodology ?? null,
        status: input.status ?? 'active',
        startDate: input.startDate ?? null,
        endDate: input.endDate ?? null,
        institutionId: input.institutionId ?? null,
        piResearcherId,
      },
    });
    await tx.projectMember.create({
      data: { projectId: project.id, researcherId: piResearcherId, role: 'Principal Investigator' },
    });
    await tx.auditLog.create({
      data: {
        actorId,
        action: 'project.create',
        entityType: 'project',
        entityId: project.id,
        after: { publicId, title: input.title },
      },
    });
    return { id: project.id, slug: project.slug, publicId };
  });
}

const projectInclude = {
  pi: { select: { slug: true, displayName: true } },
  institution: { select: { slug: true, name: true } },
  funder: true,
  grant: true,
  members: { include: { researcher: { select: { slug: true, displayName: true } } } },
  datasets: { where: { deletedAt: null }, select: { slug: true, title: true, accessLevel: true } },
  instruments: { where: { deletedAt: null }, select: { slug: true, title: true, construct: true } },
  software: { where: { deletedAt: null }, select: { slug: true, name: true } },
  publications: {
    include: { publication: { select: { slug: true, title: true, publishedYear: true } } },
  },
} satisfies Prisma.ProjectInclude;

export type ProjectDetail = Prisma.ProjectGetPayload<{ include: typeof projectInclude }>;

export async function getProjectBySlug(
  slug: string,
  client: PrismaClient = prisma,
): Promise<ProjectDetail | null> {
  return client.project.findFirst({ where: { slug, deletedAt: null }, include: projectInclude });
}

export async function listProjects(
  params: { query?: string | undefined; take?: number; skip?: number } = {},
  client: PrismaClient = prisma,
) {
  const take = Math.min(params.take ?? 20, 100);
  const skip = params.skip ?? 0;
  const where: Prisma.ProjectWhereInput = {
    deletedAt: null,
    visibility: 'public',
    ...(params.query ? { title: { contains: params.query, mode: 'insensitive' } } : {}),
  };
  const [items, total] = await Promise.all([
    client.project.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take,
      skip,
      include: { pi: { select: { slug: true, displayName: true } }, institution: { select: { name: true } } },
    }),
    client.project.count({ where }),
  ]);
  return { items, total };
}

export async function addProjectMember(
  projectId: string,
  researcherId: string,
  role: string | null,
  client: PrismaClient = prisma,
): Promise<void> {
  await client.projectMember.upsert({
    where: { projectId_researcherId: { projectId, researcherId } },
    update: { role },
    create: { projectId, researcherId, role },
  });
}

export async function linkPublicationToProject(
  projectId: string,
  publicationId: string,
  client: PrismaClient = prisma,
): Promise<void> {
  const project = await client.project.findUnique({ where: { id: projectId } });
  if (!project) throw notFound('Project not found');
  await client.projectPublication.upsert({
    where: { projectId_publicationId: { projectId, publicationId } },
    update: {},
    create: { projectId, publicationId },
  });
}
