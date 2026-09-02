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
import { notFound, forbidden } from './errors';
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

export interface ManualPublicationInput {
  title: string;
  outputType?: string;
  abstract?: string | null;
  publishedYear?: number | null;
  venue?: string | null; // journal / conference / publisher venue
  publisher?: string | null;
  /** An uploaded file's storage id to attach as the primary file. */
  primaryFileId?: string | null;
  /**
   * Other authors on the work, so the uploader isn't shown as sole author. Each
   * is stored by name. A co-author is linked to their ResearchTrics profile —
   * so the work counts on THEIR profile and metrics too — when the uploader
   * either selects them from the platform (`researcherId`, an explicit
   * assertion) or supplies a verified `orcid`. Linked co-authors are notified.
   */
  coAuthors?: Array<{ name: string; orcid?: string | null; researcherId?: string | null }>;
}

/**
 * Create a publication the researcher enters by hand (Spec §9, §11) — for
 * outputs without a DOI (books, presentations, reports, theses). DOI'd works use
 * the import-by-DOI flow instead. The current researcher is linked as the first
 * author so it appears on their profile immediately.
 */
export async function createManualPublication(
  researcherId: string,
  authorName: string,
  input: ManualPublicationInput,
  client: PrismaClient = prisma,
): Promise<CreatePublicationResult> {
  const title = input.title.trim();
  if (!title) throw notFound('A title is required');
  const outputType = (
    input.outputType && OUTPUT_TYPES.has(input.outputType) ? input.outputType : 'journal_article'
  ) as Prisma.PublicationCreateInput['outputType'];

  const serial = await nextPublicationSerial(client);
  const publicId = formatOutputId('publication', serial);
  const slug = slugWithSuffix(title, String(serial));

  const journalId = input.venue
    ? await upsertJournal({ name: input.venue, publisher: input.publisher ?? undefined }, client)
    : null;

  // Resolve co-authors to platform profiles so the work counts on their profile
  // too. Two safe linking paths: an explicit `researcherId` the uploader picked
  // from the platform, or a verified ORCID. We never fuzzy-match by name (that
  // could silently attribute a work to the wrong person and inflate metrics).
  const coAuthors = (input.coAuthors ?? [])
    .map((c) => ({
      name: c.name?.trim() ?? '',
      orcid: c.orcid?.trim() || null,
      researcherId: c.researcherId?.trim() || null,
    }))
    .filter((c) => c.name.length > 0)
    .slice(0, 30);
  const coAuthorLinks = await Promise.all(
    coAuthors.map(async (c) => {
      // Explicit selection from the platform is authoritative — but validate the
      // profile exists (and isn't the uploader, who is already author 0).
      if (c.researcherId && c.researcherId !== researcherId) {
        const exists = await client.researcher.findFirst({
          where: { id: c.researcherId, deletedAt: null },
          select: { id: true },
        });
        if (exists) return exists.id;
      }
      if (c.orcid) {
        const idRow = await client.researcherIdentifier.findUnique({
          where: { scheme_value: { scheme: 'orcid', value: c.orcid } },
          select: { researcherId: true, verified: true },
        });
        if (idRow?.verified && idRow.researcherId !== researcherId) return idRow.researcherId;
      }
      return null;
    }),
  );

  const pub = await client.publication.create({
    data: {
      publicId,
      slug,
      title,
      abstract: input.abstract ?? null,
      outputType,
      journalId,
      publisher: input.publisher ?? null,
      publishedYear: input.publishedYear ?? null,
      primaryFileId: input.primaryFileId ?? null,
      authors: {
        create: [
          { researcherId, authorOrder: 0, rawName: authorName, matchConfidence: 1 },
          ...coAuthors.map((c, i) => ({
            authorOrder: i + 1,
            rawName: c.name,
            orcid: c.orcid,
            researcherId: coAuthorLinks[i] ?? null,
            matchConfidence: coAuthorLinks[i] ? 0.99 : null,
          })),
        ],
      },
    },
  });

  // Tell each linked co-author the work now counts on their profile, so they can
  // confirm it or remove themselves if they were tagged in error.
  const linkedCoAuthorIds = Array.from(
    new Set(coAuthorLinks.filter((id): id is string => !!id && id !== researcherId)),
  );
  for (const recipientId of linkedCoAuthorIds) {
    await client.notification.create({
      data: {
        recipientId,
        publicationId: pub.id,
        type: 'coauthor_added',
        actorLabel: authorName,
      },
    });
  }

  return { status: 'created', publicationId: pub.id, slug };
}

/**
 * Ensure a researcher is linked as an author of a publication (§15, §58). Prefers
 * matching an existing authorship by ORCID, then by name; if none matches, adds a
 * lower-confidence authorship (the researcher asserted ownership, e.g. by
 * importing their own DOI). Idempotent — never double-links.
 */
export async function linkResearcherToPublication(
  publicationId: string,
  researcher: { id: string; displayName: string; orcid?: string | undefined },
  client: PrismaClient = prisma,
): Promise<void> {
  const already = await client.publicationAuthor.findFirst({
    where: { publicationId, researcherId: researcher.id },
    select: { id: true },
  });
  if (already) return;

  const or: Array<Record<string, string>> = [{ rawName: researcher.displayName }];
  if (researcher.orcid) or.push({ orcid: researcher.orcid });
  const updated = await client.publicationAuthor.updateMany({
    where: { publicationId, researcherId: null, OR: or },
    data: { researcherId: researcher.id, matchConfidence: researcher.orcid ? 0.95 : 0.7 },
  });
  if (updated.count === 0) {
    const count = await client.publicationAuthor.count({ where: { publicationId } });
    await client.publicationAuthor.create({
      data: {
        publicationId,
        researcherId: researcher.id,
        authorOrder: count,
        rawName: researcher.displayName,
        matchConfidence: 0.5,
      },
    });
  }
}

/** Find an existing publication id by DOI, if any. */
export async function findPublicationByDoi(
  doi: string,
  client: PrismaClient = prisma,
): Promise<{ id: string; slug: string; deletedAt: Date | null } | null> {
  return findPublicationByIdentifier('doi', doi.toLowerCase(), client);
}

/**
 * Find an existing publication by any external identifier (doi, openalex, …).
 * The (scheme, value) pair is globally unique, so this is the dedup key used to
 * avoid creating a second row for a work already in the graph — essential for
 * federation, where the same work is discovered via several co-authors.
 *
 * Returns soft-deleted matches too (with `deletedAt` set) — the DOI is globally
 * unique, so a re-import can't create a fresh row; callers restore instead.
 */
export async function findPublicationByIdentifier(
  scheme: PublicationIdScheme,
  value: string,
  client: PrismaClient = prisma,
): Promise<{ id: string; slug: string; deletedAt: Date | null } | null> {
  const idRow = await client.publicationIdentifier.findUnique({
    where: { scheme_value: { scheme, value } },
    include: { publication: { select: { id: true, slug: true, deletedAt: true } } },
  });
  return idRow?.publication ?? null;
}

/**
 * Un-delete a previously soft-deleted publication so a re-import brings it back
 * (its DOI is globally unique, so we restore rather than create a duplicate).
 * No-op when it isn't deleted.
 */
export async function restorePublication(id: string, client: PrismaClient = prisma): Promise<void> {
  await client.publication.update({
    where: { id },
    data: { deletedAt: null },
  });
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

  // Dedup against the graph before creating — a work discovered via several
  // co-authors must resolve to ONE publication. Check DOI first, then OpenAlex id
  // (the identifier pair is globally unique, so creating a second row would throw).
  if (doi) {
    const existing = await findPublicationByDoi(doi, client);
    if (existing) {
      // A previously-removed work being re-imported: bring it back rather than
      // returning a dead slug (which would 404) or hitting the unique DOI.
      if (existing.deletedAt) await restorePublication(existing.id, client);
      return { status: 'exists', publicationId: existing.id, slug: existing.slug };
    }
  }
  if (input.openAlexId) {
    const existing = await findPublicationByIdentifier('openalex', input.openAlexId, client);
    if (existing) {
      if (existing.deletedAt) await restorePublication(existing.id, client);
      return { status: 'exists', publicationId: existing.id, slug: existing.slug };
    }
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

    // Identifiers. skipDuplicates is a safety net: the (scheme, value) pair is
    // globally unique, and the dedup checks above should already have routed a
    // known work to its existing row — but a concurrent ingest must never crash
    // the whole works-import for a researcher.
    const identifiers: Array<{ publicationId: string; scheme: PublicationIdScheme; value: string }> = [];
    if (doi) identifiers.push({ publicationId: pub.id, scheme: 'doi', value: doi });
    if (input.openAlexId) identifiers.push({ publicationId: pub.id, scheme: 'openalex', value: input.openAlexId });
    if (identifiers.length) {
      await tx.publicationIdentifier.createMany({ data: identifiers, skipDuplicates: true });
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
    include: { researcher: { select: { id: true, slug: true, displayName: true, photoUrl: true } } },
  },
  // Uploaded full text — surfaced as citation_pdf_url for Google Scholar (§11).
  primaryFile: { select: { storageKey: true, mimeType: true } },
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

/**
 * Remove a publication from a researcher's profile (§9). If they are the only
 * linked author (a manual add / duplicate / error), the whole record is
 * soft-deleted. If the work has other linked authors, only this researcher's
 * authorship is detached — the shared record is preserved for the co-authors.
 */
export async function removePublicationForResearcher(
  researcherId: string,
  publicationId: string,
  client: PrismaClient = prisma,
): Promise<{ deleted: boolean; unlinked: boolean }> {
  const authorship = await client.publicationAuthor.findFirst({
    where: { publicationId, researcherId, publication: { deletedAt: null } },
    select: { id: true },
  });
  if (!authorship) throw forbidden('You are not listed as an author of this publication.');

  // Other linked authors: a researcher_id that is set and not this researcher.
  const linked = await client.publicationAuthor.findMany({
    where: { publicationId, researcherId: { not: null } },
    select: { researcherId: true },
  });
  const otherLinked = linked.filter((a) => a.researcherId && a.researcherId !== researcherId).length;

  if (otherLinked === 0) {
    await client.publication.update({ where: { id: publicationId }, data: { deletedAt: new Date() } });
    return { deleted: true, unlinked: false };
  }
  await client.publicationAuthor.update({
    where: { id: authorship.id },
    data: { researcherId: null, matchConfidence: null },
  });
  return { deleted: false, unlinked: true };
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
      include: {
        authors: {
          orderBy: { authorOrder: 'asc' },
          take: 8,
          include: { researcher: { select: { slug: true, photoUrl: true } } },
        },
        journal: true,
      },
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
