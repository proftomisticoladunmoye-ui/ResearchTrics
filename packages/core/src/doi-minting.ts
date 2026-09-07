import { prisma, type PrismaClient } from '@researchtrics/db';
import { badRequest, notFound, conflict } from './errors';
import { logger } from './logger';
import { normalizeOrcid } from './orcid';

/**
 * DataCite DOI minting (Spec §37). Registers a citable, resolvable DOI for a
 * ResearchTrics publication that doesn't already have one — the single biggest
 * structural boost to citability for platform-native outputs (books, theses,
 * reports, datasets) that arrive without a DOI.
 *
 * Adapted from the DataCite REST `/dois` schema (creators/titles/types/… under
 * `data.attributes`). Fully gated on credentials: a no-op unless the four
 * DATACITE_* env vars are set, so it stays dormant until an operator enables it.
 * The transformation is pure and unit-tested; the network call is injectable.
 */

export interface DataCiteMintConfig {
  /** `https://api.datacite.org` (production) or `https://api.test.datacite.org`. */
  endpoint: string;
  /** Repository account id (the Basic-auth username). */
  repositoryId: string;
  /** Repository password (the Basic-auth secret). */
  password: string;
  /** DOI prefix assigned to the account, e.g. `10.12345`. */
  prefix: string;
}

export function dataCiteConfigFromEnv(env: NodeJS.ProcessEnv = process.env): DataCiteMintConfig | null {
  const endpoint = env.DATACITE_ENDPOINT;
  const repositoryId = env.DATACITE_REPOSITORY_ID;
  const password = env.DATACITE_PASSWORD;
  const prefix = env.DATACITE_PREFIX;
  if (!endpoint || !repositoryId || !password || !prefix) return null;
  return { endpoint: endpoint.replace(/\/$/, ''), repositoryId, password, prefix };
}

export function isDataCiteMintConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return dataCiteConfigFromEnv(env) !== null;
}

/** Our output types → DataCite `resourceTypeGeneral` (schema 4.x) + a free-text `resourceType`. */
function resourceTypeFor(outputType: string): { resourceTypeGeneral: string; resourceType: string } {
  const map: Record<string, string> = {
    journal_article: 'JournalArticle',
    conference_paper: 'ConferencePaper',
    conference_proceeding: 'ConferenceProceeding',
    preprint: 'Preprint',
    postprint: 'Preprint',
    working_paper: 'Preprint',
    book: 'Book',
    book_chapter: 'BookChapter',
    thesis: 'Dissertation',
    dissertation: 'Dissertation',
    technical_report: 'Report',
    research_report: 'Report',
    research_brief: 'Report',
    policy_brief: 'Report',
    dataset: 'Dataset',
    software: 'Software',
    systematic_review: 'JournalArticle',
    meta_analysis: 'JournalArticle',
    registered_report: 'JournalArticle',
  };
  const general = map[outputType] ?? 'Text';
  // Human-readable label preserves the specific type DataCite has no enum for.
  const resourceType = outputType
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
  return { resourceTypeGeneral: general, resourceType };
}

/** One author → a DataCite creator, splitting personal names and attaching an ORCID. */
function creatorFor(a: {
  rawName: string;
  givenName: string | null;
  familyName: string | null;
  orcid: string | null;
}): Record<string, unknown> {
  // Personal names have a family name (given/family columns) or a "Family, Given"
  // raw string; anything else is treated as an organization.
  let givenName = a.givenName ?? undefined;
  let familyName = a.familyName ?? undefined;
  if (!familyName && a.rawName.includes(',')) {
    const [fam, giv] = a.rawName.split(',', 2).map((s) => s.trim());
    familyName = fam || undefined;
    givenName = giv || undefined;
  }
  const isPersonal = !!familyName;
  const creator: Record<string, unknown> = {
    name: a.rawName,
    nameType: isPersonal ? 'Personal' : 'Organizational',
  };
  if (isPersonal) {
    if (givenName) creator.givenName = givenName;
    if (familyName) creator.familyName = familyName;
  }
  const orcid = normalizeOrcid(a.orcid);
  if (orcid) {
    creator.nameIdentifiers = [
      {
        schemeUri: 'https://orcid.org',
        nameIdentifier: `https://orcid.org/${orcid}`,
        nameIdentifierScheme: 'ORCID',
      },
    ];
  }
  return creator;
}

export interface MintablePublication {
  title: string;
  slug: string;
  outputType: string;
  abstract: string | null;
  publishedYear: number | null;
  publisher: string | null;
  journalName: string | null;
  authors: Array<{ rawName: string; givenName: string | null; familyName: string | null; orcid: string | null }>;
}

/**
 * Build the DataCite `data.attributes` for a publication. Pure + testable. When
 * `publish` is true the DOI is registered as **findable** (resolvable, permanent)
 * — which requires a landing `url`; otherwise it is a **draft** (deletable).
 */
export function buildDataCiteAttributes(
  pub: MintablePublication,
  landingUrl: string,
  prefix: string,
  publish: boolean,
): Record<string, unknown> {
  const { resourceTypeGeneral, resourceType } = resourceTypeFor(pub.outputType);
  const attributes: Record<string, unknown> = {
    prefix,
    url: landingUrl,
    // DataCite requires a publisher, a 4-digit year, titles, creators, and types.
    titles: [{ title: pub.title }],
    publisher: pub.publisher ?? pub.journalName ?? 'ResearchTrics',
    publicationYear: pub.publishedYear ?? new Date().getUTCFullYear(),
    types: { resourceTypeGeneral, resourceType },
    creators: (pub.authors.length > 0 ? pub.authors : [{ rawName: 'Unknown', givenName: null, familyName: null, orcid: null }]).map(
      creatorFor,
    ),
    language: 'en',
  };
  if (pub.abstract && pub.abstract.trim()) {
    attributes.descriptions = [{ description: pub.abstract.trim(), descriptionType: 'Abstract', lang: 'en' }];
  }
  if (publish) attributes.event = 'publish';
  return attributes;
}

export interface MintDoiResult {
  doi: string;
  status: 'minted' | 'exists';
  /** `findable` (published) or `draft`. */
  state: string;
}

/**
 * POST a DataCite `dois` request and return the assigned DOI + state. Shared by
 * every minting caller (publications, bulletins). Throws a clear error carrying
 * DataCite's own message when the request is rejected.
 */
export async function submitDataCiteDoi(
  config: DataCiteMintConfig,
  attributes: Record<string, unknown>,
  publish: boolean,
  fetchImpl: typeof fetch = fetch,
): Promise<{ doi: string; state: string }> {
  const auth = Buffer.from(`${config.repositoryId}:${config.password}`).toString('base64');
  const res = await fetchImpl(`${config.endpoint}/dois`, {
    method: 'POST',
    headers: { 'content-type': 'application/vnd.api+json', authorization: `Basic ${auth}` },
    body: JSON.stringify({ data: { type: 'dois', attributes } }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    logger.error({ status: res.status, detail: detail.slice(0, 300) }, 'DataCite mint failed');
    throw badRequest(`DataCite rejected the DOI request (${res.status}). ${detail.slice(0, 200)}`);
  }
  const json = (await res.json()) as { data?: { id?: string; attributes?: { state?: string } } };
  const doi = json.data?.id;
  const state = json.data?.attributes?.state ?? (publish ? 'findable' : 'draft');
  if (!doi) throw badRequest('DataCite did not return a DOI');
  return { doi, state };
}

/**
 * Mint (or return the existing) DOI for a publication. Guards against
 * double-minting: a work that already has a DOI is returned unchanged. On
 * success the DOI is stored as a verified `doi` identifier and audited.
 */
export async function mintPublicationDoi(
  publicationId: string,
  opts: { publish?: boolean; appUrl?: string; fetchImpl?: typeof fetch; actorId?: string } = {},
  client: PrismaClient = prisma,
): Promise<MintDoiResult> {
  const config = dataCiteConfigFromEnv();
  if (!config) {
    throw badRequest(
      'DOI minting is not configured on this server. An administrator must set DATACITE_ENDPOINT, DATACITE_REPOSITORY_ID, DATACITE_PASSWORD, and DATACITE_PREFIX.',
    );
  }

  const pub = await client.publication.findFirst({
    where: { id: publicationId, deletedAt: null },
    include: {
      journal: { select: { name: true } },
      identifiers: { where: { scheme: 'doi' }, select: { value: true }, take: 1 },
      authors: {
        orderBy: { authorOrder: 'asc' },
        select: { rawName: true, givenName: true, familyName: true, orcid: true },
      },
    },
  });
  if (!pub) throw notFound('Publication not found');
  if (pub.identifiers.length > 0) {
    return { doi: pub.identifiers[0]!.value, status: 'exists', state: 'existing' };
  }

  const appUrl = (opts.appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.researchtrics.com').replace(/\/$/, '');
  const landingUrl = `${appUrl}/publications/${pub.slug}`;
  const publish = opts.publish ?? true;
  const attributes = buildDataCiteAttributes(
    {
      title: pub.title,
      slug: pub.slug,
      outputType: pub.outputType,
      abstract: pub.abstract,
      publishedYear: pub.publishedYear,
      publisher: pub.publisher,
      journalName: pub.journal?.name ?? null,
      authors: pub.authors,
    },
    landingUrl,
    config.prefix,
    publish,
  );

  const { doi, state } = await submitDataCiteDoi(config, attributes, publish, opts.fetchImpl);

  try {
    await client.$transaction([
      client.publicationIdentifier.create({
        data: { publicationId, scheme: 'doi', value: doi.toLowerCase() },
      }),
      client.auditLog.create({
        data: {
          actorId: opts.actorId ?? null,
          action: 'publication.doi.mint',
          entityType: 'publication',
          entityId: publicationId,
          after: { doi, state },
        },
      }),
    ]);
  } catch (err) {
    // The DOI was registered at DataCite even if we failed to record it locally;
    // surface it rather than losing it.
    logger.error({ err, doi }, 'DOI minted but failed to persist locally');
    throw conflict(`DOI ${doi} was minted but could not be saved locally — please retry to link it.`);
  }

  logger.info({ publicationId, doi, state }, 'DOI minted');
  return { doi, status: 'minted', state };
}
