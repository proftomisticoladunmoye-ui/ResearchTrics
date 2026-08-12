import {
  prisma,
  nextOutputSerial,
  type PrismaClient,
  type Prisma,
  type DatasetAccessLevel,
} from '@researchtrics/db';
import { formatOutputId, slugWithSuffix } from './id';

/**
 * Dataset, instrument and software services (Spec §20–22). Restricted datasets
 * are never exposed: only public records are listed, and access conditions are
 * surfaced explicitly. (File hosting for restricted content lands with signed
 * URLs in a later phase.)
 */

// ---------- Datasets (Spec §20) ----------

export interface CreateDatasetInput {
  title: string;
  description?: string | null;
  institutionId?: string | null;
  sample?: string | null;
  geography?: string | null;
  methodology?: string | null;
  variablesText?: string | null;
  fileFormats?: string | null;
  accessLevel?: DatasetAccessLevel;
  licenseCode?: string | null;
  doi?: string | null;
  ethicsInfo?: string | null;
  version?: string | null;
  relatedProjectId?: string | null;
}

export async function createDataset(
  creatorResearcherId: string,
  input: CreateDatasetInput,
  client: PrismaClient = prisma,
): Promise<{ slug: string; publicId: string }> {
  const serial = await nextOutputSerial('dataset', client);
  const publicId = formatOutputId('dataset', serial);
  const slug = slugWithSuffix(input.title, String(serial));
  const dataset = await client.dataset.create({
    data: {
      publicId,
      slug,
      title: input.title,
      description: input.description ?? null,
      creatorResearcherId,
      institutionId: input.institutionId ?? null,
      sample: input.sample ?? null,
      geography: input.geography ?? null,
      methodology: input.methodology ?? null,
      variablesText: input.variablesText ?? null,
      fileFormats: input.fileFormats ?? null,
      accessLevel: input.accessLevel ?? 'open',
      licenseCode: input.licenseCode ?? null,
      doi: input.doi ?? null,
      ethicsInfo: input.ethicsInfo ?? null,
      version: input.version ?? null,
      relatedProjectId: input.relatedProjectId ?? null,
    },
  });
  return { slug: dataset.slug, publicId };
}

const datasetInclude = {
  creator: { select: { slug: true, displayName: true } },
  institution: { select: { slug: true, name: true } },
  project: { select: { slug: true, title: true } },
} satisfies Prisma.DatasetInclude;

export type DatasetDetail = Prisma.DatasetGetPayload<{ include: typeof datasetInclude }>;

export async function getDatasetBySlug(slug: string, client: PrismaClient = prisma) {
  return client.dataset.findFirst({ where: { slug, deletedAt: null }, include: datasetInclude });
}

export async function listDatasets(
  params: { query?: string | undefined; take?: number; skip?: number } = {},
  client: PrismaClient = prisma,
) {
  const take = Math.min(params.take ?? 20, 100);
  const where: Prisma.DatasetWhereInput = {
    deletedAt: null,
    visibility: 'public',
    ...(params.query ? { title: { contains: params.query, mode: 'insensitive' } } : {}),
  };
  const [items, total] = await Promise.all([
    client.dataset.findMany({ where, orderBy: { updatedAt: 'desc' }, take, skip: params.skip ?? 0 }),
    client.dataset.count({ where }),
  ]);
  return { items, total };
}

// ---------- Instruments (Spec §21) ----------

export interface CreateInstrumentInput {
  title: string;
  construct?: string | null;
  population?: string | null;
  language?: string | null;
  country?: string | null;
  itemCount?: number | null;
  responseScale?: string | null;
  scoringMethod?: string | null;
  reliability?: string | null;
  validityEvidence?: string | null;
  factorStructure?: string | null;
  norms?: string | null;
  copyright?: string | null;
  licenseCode?: string | null;
  doi?: string | null;
  relatedProjectId?: string | null;
  relatedDatasetId?: string | null;
}

export async function createInstrument(
  authorResearcherId: string,
  input: CreateInstrumentInput,
  client: PrismaClient = prisma,
): Promise<{ slug: string; publicId: string }> {
  const serial = await nextOutputSerial('instrument', client);
  const publicId = formatOutputId('instrument', serial);
  const slug = slugWithSuffix(input.title, String(serial));
  const row = await client.instrument.create({
    data: {
      publicId,
      slug,
      title: input.title,
      construct: input.construct ?? null,
      population: input.population ?? null,
      language: input.language ?? null,
      country: input.country ?? null,
      itemCount: input.itemCount ?? null,
      responseScale: input.responseScale ?? null,
      scoringMethod: input.scoringMethod ?? null,
      reliability: input.reliability ?? null,
      validityEvidence: input.validityEvidence ?? null,
      factorStructure: input.factorStructure ?? null,
      norms: input.norms ?? null,
      copyright: input.copyright ?? null,
      licenseCode: input.licenseCode ?? null,
      doi: input.doi ?? null,
      authorResearcherId,
      relatedProjectId: input.relatedProjectId ?? null,
      relatedDatasetId: input.relatedDatasetId ?? null,
    },
  });
  return { slug: row.slug, publicId };
}

const instrumentInclude = {
  author: { select: { slug: true, displayName: true } },
  project: { select: { slug: true, title: true } },
  dataset: { select: { slug: true, title: true } },
} satisfies Prisma.InstrumentInclude;

export type InstrumentDetail = Prisma.InstrumentGetPayload<{ include: typeof instrumentInclude }>;

export async function getInstrumentBySlug(slug: string, client: PrismaClient = prisma) {
  return client.instrument.findFirst({ where: { slug, deletedAt: null }, include: instrumentInclude });
}

export async function listInstruments(
  params: { query?: string | undefined; take?: number; skip?: number } = {},
  client: PrismaClient = prisma,
) {
  const take = Math.min(params.take ?? 20, 100);
  const where: Prisma.InstrumentWhereInput = {
    deletedAt: null,
    visibility: 'public',
    ...(params.query ? { title: { contains: params.query, mode: 'insensitive' } } : {}),
  };
  const [items, total] = await Promise.all([
    client.instrument.findMany({ where, orderBy: { updatedAt: 'desc' }, take, skip: params.skip ?? 0 }),
    client.instrument.count({ where }),
  ]);
  return { items, total };
}

// ---------- Software (Spec §22) ----------

export interface CreateSoftwareInput {
  name: string;
  description?: string | null;
  version?: string | null;
  repositoryUrl?: string | null;
  doi?: string | null;
  licenseCode?: string | null;
  documentationUrl?: string | null;
  citationText?: string | null;
  relatedProjectId?: string | null;
}

export async function createSoftware(
  authorResearcherId: string,
  input: CreateSoftwareInput,
  client: PrismaClient = prisma,
): Promise<{ slug: string; publicId: string }> {
  const serial = await nextOutputSerial('software', client);
  const publicId = formatOutputId('software', serial);
  const slug = slugWithSuffix(input.name, String(serial));
  const row = await client.software.create({
    data: {
      publicId,
      slug,
      name: input.name,
      description: input.description ?? null,
      version: input.version ?? null,
      repositoryUrl: input.repositoryUrl ?? null,
      doi: input.doi ?? null,
      licenseCode: input.licenseCode ?? null,
      documentationUrl: input.documentationUrl ?? null,
      citationText: input.citationText ?? null,
      authorResearcherId,
      relatedProjectId: input.relatedProjectId ?? null,
    },
  });
  return { slug: row.slug, publicId };
}

const softwareInclude = {
  author: { select: { slug: true, displayName: true } },
  project: { select: { slug: true, title: true } },
} satisfies Prisma.SoftwareInclude;

export type SoftwareDetail = Prisma.SoftwareGetPayload<{ include: typeof softwareInclude }>;

export async function getSoftwareBySlug(slug: string, client: PrismaClient = prisma) {
  return client.software.findFirst({ where: { slug, deletedAt: null }, include: softwareInclude });
}

export async function listSoftware(
  params: { query?: string | undefined; take?: number; skip?: number } = {},
  client: PrismaClient = prisma,
) {
  const take = Math.min(params.take ?? 20, 100);
  const where: Prisma.SoftwareWhereInput = {
    deletedAt: null,
    visibility: 'public',
    ...(params.query ? { name: { contains: params.query, mode: 'insensitive' } } : {}),
  };
  const [items, total] = await Promise.all([
    client.software.findMany({ where, orderBy: { updatedAt: 'desc' }, take, skip: params.skip ?? 0 }),
    client.software.count({ where }),
  ]);
  return { items, total };
}
