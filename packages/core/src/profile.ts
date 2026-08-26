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

/** A single onboarding step and whether the researcher has completed it. */
export interface OnboardingStep {
  key: 'profile' | 'orcid' | 'affiliation' | 'publications' | 'outputs';
  label: string;
  href: string;
  done: boolean;
}

/**
 * Compute the researcher's real onboarding state so the dashboard "Next steps"
 * reflects what they have actually done (rather than a static list). Each step
 * is a concrete, checkable signal. Steps already completed are marked done so
 * the UI can hide them and congratulate a fully set-up researcher.
 */
export async function getOnboardingChecklist(
  researcherId: string,
  client: PrismaClient = prisma,
): Promise<OnboardingStep[]> {
  const [researcher, affiliations, publications, projects, datasets, instruments, software, orcidConnection] =
    await Promise.all([
      client.researcher.findUnique({
        where: { id: researcherId },
        select: { biography: true, identifiers: { where: { scheme: 'orcid' }, select: { verified: true } } },
      }),
      client.affiliation.count({ where: { researcherId } }),
      client.publicationAuthor.count({
        where: { researcherId, publication: { deletedAt: null } },
      }),
      client.project.count({ where: { piResearcherId: researcherId } }),
      client.dataset.count({ where: { creatorResearcherId: researcherId } }),
      client.instrument.count({ where: { authorResearcherId: researcherId } }),
      client.software.count({ where: { authorResearcherId: researcherId } }),
      client.orcidConnection.findFirst({ where: { researcherId }, select: { id: true } }),
    ]);

  const hasBiography = !!researcher?.biography && researcher.biography.trim().length > 0;
  const hasOrcid = !!orcidConnection || (researcher?.identifiers.some((i) => i.verified) ?? false);
  const outputsTotal = projects + datasets + instruments + software;

  return [
    { key: 'profile', label: 'Complete your profile (bio, photo, interests)', href: '/dashboard/profile', done: hasBiography },
    { key: 'orcid', label: 'Connect your ORCID iD', href: '/dashboard/profile', done: hasOrcid },
    { key: 'affiliation', label: 'Add your institutional affiliation', href: '/dashboard/profile', done: affiliations > 0 },
    { key: 'publications', label: 'Add your publications (import by DOI or upload)', href: '/dashboard/publications', done: publications > 0 },
    { key: 'outputs', label: 'Add a project, dataset, instrument, or software', href: '/dashboard/outputs', done: outputsTotal > 0 },
  ];
}

/** One publication as shown on a researcher's profile. */
export interface ProfilePublication {
  id: string;
  slug: string;
  title: string;
  year: number | null;
  venue: string | null;
  outputType: string;
  doi: string | null;
  citationCount: number | null;
  /** How the authorship is evidenced — a claimed link vs. an auto-discovered one. */
  claimed: boolean;
}

/**
 * List a researcher's public publications for their profile, newest first, each
 * with its venue, year, and best-available citation count. Only public,
 * non-deleted works are returned (Spec §36).
 */
export async function listResearcherPublications(
  researcherId: string,
  opts: { take?: number } = {},
  client: PrismaClient = prisma,
): Promise<ProfilePublication[]> {
  const authorships = await client.publicationAuthor.findMany({
    where: { researcherId, publication: { deletedAt: null, visibility: 'public' } },
    include: {
      publication: {
        include: {
          journal: { select: { name: true } },
          citationCounts: { select: { count: true } },
          identifiers: { where: { scheme: 'doi' }, select: { value: true }, take: 1 },
        },
      },
    },
    orderBy: [{ publication: { publishedYear: 'desc' } }, { publication: { title: 'asc' } }],
    take: opts.take ?? 100,
  });

  return authorships.map((a) => {
    const p = a.publication;
    const citationCount = p.citationCounts.length
      ? Math.max(...p.citationCounts.map((c) => c.count))
      : null;
    return {
      id: p.id,
      slug: p.slug,
      title: p.title,
      year: p.publishedYear,
      venue: p.journal?.name ?? null,
      outputType: p.outputType,
      doi: p.identifiers[0]?.value ?? null,
      citationCount,
      claimed: a.matchConfidence === 1,
    };
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
): Promise<{ items: Array<Pick<ResearcherProfile, 'id' | 'displayName' | 'slug' | 'researchtricsId' | 'country' | 'academicRank' | 'verificationLevel' | 'photoUrl'>>; total: number }> {
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
        photoUrl: true,
      },
    }),
    client.researcher.count({ where }),
  ]);

  return { items, total };
}
