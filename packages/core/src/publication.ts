import {
  prisma,
  nextPublicationSerial,
  type PrismaClient,
  type Prisma,
  type ExternalSource,
  type PublicationIdScheme,
  type CitationSource,
} from '@researchtrics/db';
import { formatOutputId, slugWithSuffix } from './id';
import { notFound } from './errors';
import type { CitationData } from './citation-export';

/**
 * Publication persistence (Spec §10, §33, §56–58). Orchestration of external
 * sources (Crossref/OpenAlex) lives outside core to avoid a dependency cycle;
 * core receives already-normalized data and owns dedup, ID minting, author
 * matching, provenance, and reads.
 */

export interface NormalizedAuthorInput {
  rawName: string;
  givenName?: string | undefined;
  familyName?: string | undefined;
  orcid?: string | undefined;
  affiliation?: string | undefined;
  isCorresponding?: boolean | undefined;
}

export interface CitationCountInput {
  source: CitationSource;
  count: number;
}

export interface ProvenanceInput {
  source: ExternalSource;
  sourceId: string;
  sourceUrl?: string | undefined;
  raw?: unknown;
}

export interface CreatePublicationInput {
  title: string;
  abstract?: string | undefined;
  doi?: string | undefined;
  outputType?: string | undefined;
  journalTitle?: string | undefined;
  issnPrint?: string | undefined;
  issnElectronic?: string | undefined;
  volume?: string | undefined;
  issue?: string | undefined;
  firstPage?: string | undefined;
  lastPage?: string | undefined;
  publishedYear?: number | undefined;
  publishedOn?: string | undefined;
  publisher?: string | undefined;
  licenseCode?: string | undefined;
  openAccess?: boolean | undefined;
  pdfUrl?: string | undefined;
  openAlexId?: string | undefined;
  authors: NormalizedAuthorInput[];
  citationCounts?: CitationCountInput[];
  provenance?: ProvenanceInput[];
}

const OUTPUT_TYPES = new Set([
  'journal_article','conference_paper','conference_proceeding','preprint','postprint',
  'working_paper','technical_report','research_report','thesis','dissertation','book',
  'book_chapter','dataset','instrument','software','poster','presentation','policy_brief',
  'research_brief','systematic_review','meta_analysis','registered_report','other',
]);

export interface CreatePublicationResult {
  status: 'created' | 'exists';
  publicationId: string;
  slug: string;
}

/** Find an existing publication id by DOI, if any. */
export async function findPublicationByDoi(
  doi: string,
  client: PrismaClient = prisma,
): Promise<{ id: string; slug: string } | null> {
  const idRow = await client.publicationIdentifier.findUnique({
    where: { scheme_value: { scheme: 'doi', value: doi.toLowerCase() } },
    include: { publication: { select: { id: true, slug: true } } },
  });
  return idRow?.publication ?? null;
}

/**
 * Create a publication from normalized data. Idempotent on DOI (returns the
 * existing record instead of duplicating — Spec §57). Authors are auto-linked
 * to researchers only via a verified ORCID match (Spec §58); others remain
 * unmatched but fully rendered.
 */
export async function createPublicationFromNormalized(
  input: CreatePublicationInput,
  client: PrismaClient = prisma,
): Promise<CreatePublicationResult> {
  const doi = input.doi?.toLowerCase();

  if (doi) {
    const existing = await findPublicationByDoi(doi, client);
    if (existing) return { status: 'exists', publicationId: existing.id, slug: existing.slug };
  }

  const serial = await nextPublicationSerial(client);
  const publicId = formatOutputId('publication', serial);
  const slug = slugWithSuffix(input.title, String(serial));
  const outputType = input.outputType && OUTPUT_TYPES.has(input.outputType)
    ? (input.outputType as Prisma.PublicationCreateInput['outputType'])
    : 'journal_article';

  // Resolve/attach a journal if we have a title.
  let journalId: string | null = null;
  if (input.journalTitle) {
    journalId = await upsertJournal(
      { name: input.journalTitle, issnElectronic: input.issnElectronic, issnPrint: input.issnPrint, publisher: input.publisher },
      client,
    );
  }

  // Pre-resolve author → researcher links via verified ORCID (Spec §58).
  const authorLinks = await Promise.all(
    input.authors.map(async (a) => {
      if (!a.orcid) return null;
      const idRow = await client.researcherIdentifier.findUnique({
        where: { scheme_value: { scheme: 'orcid', value: a.orcid } },
      });
      return idRow?.verified ? idRow.researcherId : null;
    }),
  );

  const created = await client.$transaction(async (tx) => {
    const pub = await tx.publication.create({
      data: {
        publicId,
        slug,
        title: input.title,
        abstract: input.abstract ?? null,
        outputType,
        journalId,
        volume: input.volume ?? null,
        issue: input.issue ?? null,
        firstPage: input.firstPage ?? null,
        lastPage: input.lastPage ?? null,
        publisher: input.publisher ?? null,
        publishedYear: input.publishedYear ?? null,
        publishedOn: input.publishedOn ? new Date(input.publishedOn) : null,
        licenseCode: input.licenseCode ?? null,
        openAccess: input.openAccess ?? false,
        pdfUrl: input.pdfUrl ?? null,
      },
    });

    // Identifiers
    const identifiers: Array<{ scheme: PublicationIdScheme; value: string }> = [];
    if (doi) identifiers.push({ scheme: 'doi', value: doi });
    if (input.openAlexId) identifiers.push({ scheme: 'openalex', value: input.openAlexId });
    for (const idf of identifiers) {
      await tx.publicationIdentifier.create({
        data: { publicationId: pub.id, scheme: idf.scheme, value: idf.value },
      });
    }

    // Authors (ordered; ORCID-matched links only)
    await tx.publicationAuthor.createMany({
      data: input.authors.map((a, i) => ({
        publicationId: pub.id,
        authorOrder: i,
        rawName: a.rawName,
        givenName: a.givenName ?? null,
        familyName: a.familyName ?? null,
        affiliationText: a.affiliation ?? null,
        orcid: a.orcid ?? null,
        isCorresponding: a.isCorresponding ?? false,
        researcherId: authorLinks[i] ?? null,
        matchConfidence: authorLinks[i] ? 0.99 : null,
      })),
    });

    // Source-labelled citation counts (Spec §33)
    for (const c of input.citationCounts ?? []) {
      await tx.publicationCitationCount.create({
        data: { publicationId: pub.id, source: c.source, count: c.count },
      });
    }

    // Provenance (Spec §84)
    for (const p of input.provenance ?? []) {
      await tx.externalRecord.upsert({
        where: {
          source_sourceId_entityType_entityId: {
            source: p.source,
            sourceId: p.sourceId,
            entityType: 'publication',
            entityId: pub.id,
          },
        },
        update: { lastSyncedAt: new Date(), rawPayload: (p.raw ?? null) as Prisma.InputJsonValue },
        create: {
          source: p.source,
          sourceId: p.sourceId,
          sourceUrl: p.sourceUrl ?? null,
          entityType: 'publication',
          entityId: pub.id,
          retrievedAt: new Date(),
          lastSyncedAt: new Date(),
          rawPayload: (p.raw ?? null) as Prisma.InputJsonValue,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        action: 'publication.import',
        entityType: 'publication',
        entityId: pub.id,
        after: { publicId, doi: doi ?? null, title: input.title },
      },
    });

    return pub;
  });

  return { status: 'created', publicationId: created.id, slug: created.slug };
}

async function upsertJournal(
  data: { name: string; issnPrint?: string | undefined; issnElectronic?: string | undefined; publisher?: string | undefined },
  client: PrismaClient,
): Promise<string> {
  const existing = await client.journal.findFirst({
    where: { name: { equals: data.name, mode: 'insensitive' } },
  });
  if (existing) return existing.id;
  const slug = slugWithSuffix(data.name, Math.random().toString(36).slice(2, 7));
  const created = await client.journal.create({
    data: {
      name: data.name,
      slug,
      issnPrint: data.issnPrint ?? null,
      issnElectronic: data.issnElectronic ?? null,
      publisher: data.publisher ?? null,
    },
  });
  return created.id;
}

const publicationInclude = {
  journal: true,
  identifiers: true,
  citationCounts: true,
  authors: {
    orderBy: { authorOrder: 'asc' },
    include: { researcher: { select: { slug: true, displayName: true } } },
  },
} satisfies Prisma.PublicationInclude;

export type PublicationDetail = Prisma.PublicationGetPayload<{ include: typeof publicationInclude }>;

export async function getPublicationBySlug(
  slug: string,
  client: PrismaClient = prisma,
): Promise<PublicationDetail | null> {
  return client.publication.findFirst({ where: { slug, deletedAt: null }, include: publicationInclude });
}

/** Recent publications with full detail — used by the Scholar compliance dashboard. */
export async function listRecentPublicationDetails(
  take = 25,
  client: PrismaClient = prisma,
): Promise<PublicationDetail[]> {
  return client.publication.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' },
    take,
    include: publicationInclude,
  });
}

export async function listPublications(
  params: { query?: string | undefined; take?: number; skip?: number } = {},
  client: PrismaClient = prisma,
) {
  const take = Math.min(params.take ?? 20, 100);
  const skip = params.skip ?? 0;
  const where: Prisma.PublicationWhereInput = {
    deletedAt: null,
    visibility: 'public',
    ...(params.query ? { title: { contains: params.query, mode: 'insensitive' } } : {}),
  };
  const [items, total] = await Promise.all([
    client.publication.findMany({
      where,
      orderBy: [{ publishedYear: 'desc' }, { title: 'asc' }],
      take,
      skip,
      include: { authors: { orderBy: { authorOrder: 'asc' }, take: 8 }, journal: true },
    }),
    client.publication.count({ where }),
  ]);
  return { items, total };
}

/** Link an authorship row to the current researcher (claim) — audited (Spec §68). */
export async function claimAuthorship(
  publicationAuthorId: string,
  researcherId: string,
  actorId: string,
  client: PrismaClient = prisma,
): Promise<void> {
  const row = await client.publicationAuthor.findUnique({ where: { id: publicationAuthorId } });
  if (!row) throw notFound('Authorship not found');
  await client.$transaction([
    client.publicationAuthor.update({
      where: { id: publicationAuthorId },
      data: { researcherId, matchConfidence: 1 },
    }),
    client.auditLog.create({
      data: {
        actorId,
        action: 'publication.claim',
        entityType: 'publication_author',
        entityId: publicationAuthorId,
        after: { researcherId },
      },
    }),
  ]);
}

/** Build citation-export data from a loaded publication. */
export function buildCitationData(pub: PublicationDetail): CitationData {
  const doi = pub.identifiers.find((i) => i.scheme === 'doi')?.value;
  return {
    title: pub.title,
    authors: pub.authors.map((a) => ({
      given: a.givenName ?? undefined,
      family: a.familyName ?? undefined,
      literal: a.rawName,
    })),
    year: pub.publishedYear ?? undefined,
    journalTitle: pub.journal?.name ?? undefined,
    volume: pub.volume ?? undefined,
    issue: pub.issue ?? undefined,
    firstPage: pub.firstPage ?? undefined,
    lastPage: pub.lastPage ?? undefined,
    doi: doi ?? undefined,
    publisher: pub.publisher ?? undefined,
  };
}
