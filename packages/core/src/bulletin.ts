import { prisma, type PrismaClient, type Prisma, type BulletinType, type BulletinStatus } from '@researchtrics/db';

// Re-export the Prisma enum types so app code imports them from core (its single
// domain entry point) rather than reaching into the db package directly.
export type { BulletinType, BulletinStatus } from '@researchtrics/db';
import { slugify, slugWithSuffix } from './id';
import { badRequest, notFound } from './errors';
import { logger } from './logger';
import { sanitizeBulletinHtml, htmlToPlainText } from './html-sanitize';
import { formatCitation, type CitationData, type CitationFormat } from './citation-export';
import { dataCiteConfigFromEnv, buildDataCiteAttributes, submitDataCiteDoi, isDataCiteMintConfigured } from './doi-minting';
import { zenodoConfigFromEnv, isZenodoConfigured, mintZenodoDoi } from './zenodo';

/**
 * ResearchTrics Research Bulletin service (Phase 1 — scholarly publication
 * foundation). Owns numbering, slugs, publish lifecycle, public reads, and
 * citation generation. This is a scholarly publication series, NOT the blog:
 * each bulletin is a distinct, publicly-readable, citable work.
 */

export const SERIES_NAME = 'ResearchTrics Research Bulletin';
export const SERIES_PUBLISHER = 'ResearchTrics';

export interface BulletinAuthor {
  name: string;
  affiliation?: string;
  orcid?: string;
  order: number;
}

export interface BulletinReference {
  raw: string;
  doi?: string;
  url?: string;
  type?: string;
}

export const BULLETIN_TYPES: readonly BulletinType[] = [
  'research', 'methodological', 'psychometric', 'statistical', 'ai_research',
  'research_technology', 'conceptual', 'evidence', 'research_practice',
  'policy_research', 'replication', 'commentary', 'data_analysis',
];

export const BULLETIN_TYPE_LABELS: Record<BulletinType, string> = {
  research: 'Research Bulletin',
  methodological: 'Methodological Bulletin',
  psychometric: 'Psychometric Bulletin',
  statistical: 'Statistical Bulletin',
  ai_research: 'AI & Research Bulletin',
  research_technology: 'Research Technology Bulletin',
  conceptual: 'Conceptual Bulletin',
  evidence: 'Evidence Bulletin',
  research_practice: 'Research Practice Bulletin',
  policy_research: 'Policy Research Bulletin',
  replication: 'Replication Bulletin',
  commentary: 'Research Commentary',
  data_analysis: 'Data/Analysis Bulletin',
};

export const LICENSE_LABELS: Record<string, string> = {
  all_rights_reserved: 'All rights reserved',
  cc_by: 'CC BY 4.0',
  cc_by_nc: 'CC BY-NC 4.0',
  cc_by_nc_sa: 'CC BY-NC-SA 4.0',
};

export interface BulletinInput {
  title: string;
  subtitle?: string | null;
  type?: BulletinType;
  category: string;
  abstract: string;
  keywords?: string[];
  bodyHtml: string;
  authors?: BulletinAuthor[];
  references?: BulletinReference[];
  featuredImage?: string | null;
  license?: string;
}

function normalizeAuthors(input?: BulletinAuthor[]): BulletinAuthor[] {
  return (input ?? [])
    .filter((a) => a && typeof a.name === 'string' && a.name.trim().length > 0)
    .map((a, i) => ({
      name: a.name.trim(),
      ...(a.affiliation ? { affiliation: String(a.affiliation).trim() } : {}),
      ...(a.orcid ? { orcid: String(a.orcid).trim() } : {}),
      order: typeof a.order === 'number' ? a.order : i,
    }))
    .sort((x, y) => x.order - y.order);
}

function normalizeRefs(input?: BulletinReference[]): BulletinReference[] {
  return (input ?? [])
    .filter((r) => r && typeof r.raw === 'string' && r.raw.trim().length > 0)
    .map((r) => ({
      raw: r.raw.trim(),
      ...(r.doi ? { doi: String(r.doi).trim() } : {}),
      ...(r.url ? { url: String(r.url).trim() } : {}),
      ...(r.type ? { type: String(r.type).trim() } : {}),
    }));
}

/** Create a draft bulletin. Numbering is deferred until publish. */
export async function createBulletin(
  input: BulletinInput,
  authorUserId: string | null,
  client: PrismaClient = prisma,
): Promise<{ id: string; slug: string }> {
  const title = input.title?.trim();
  if (!title || title.length < 3) throw badRequest('A title of at least 3 characters is required.');
  if (!input.abstract?.trim()) throw badRequest('An abstract is required.');
  if (!input.category?.trim()) throw badRequest('A category is required.');

  const slug = slugWithSuffix(title, Math.random().toString(36).slice(2, 7));
  const created = await client.researchBulletin.create({
    data: {
      slug,
      title,
      subtitle: input.subtitle?.trim() || null,
      type: input.type ?? 'research',
      category: input.category.trim(),
      abstract: input.abstract.trim(),
      keywords: (input.keywords ?? []).map((k) => k.trim()).filter(Boolean).slice(0, 30),
      bodyHtml: sanitizeBulletinHtml(input.bodyHtml ?? ''),
      authors: normalizeAuthors(input.authors) as unknown as Prisma.InputJsonValue,
      references: normalizeRefs(input.references) as unknown as Prisma.InputJsonValue,
      featuredImage: input.featuredImage ?? null,
      license: input.license ?? 'all_rights_reserved',
      authorUserId,
    },
    select: { id: true, slug: true },
  });
  return created;
}

/** Update a bulletin's editable content (any status). Re-sanitizes the body. */
export async function updateBulletin(
  id: string,
  input: Partial<BulletinInput>,
  client: PrismaClient = prisma,
): Promise<void> {
  const existing = await client.researchBulletin.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw notFound('Bulletin not found.');
  const data: Prisma.ResearchBulletinUpdateInput = {};
  if (input.title !== undefined) data.title = input.title.trim();
  if (input.subtitle !== undefined) data.subtitle = input.subtitle?.trim() || null;
  if (input.type !== undefined) data.type = input.type;
  if (input.category !== undefined) data.category = input.category.trim();
  if (input.abstract !== undefined) data.abstract = input.abstract.trim();
  if (input.keywords !== undefined) data.keywords = input.keywords.map((k) => k.trim()).filter(Boolean).slice(0, 30);
  if (input.bodyHtml !== undefined) data.bodyHtml = sanitizeBulletinHtml(input.bodyHtml);
  if (input.authors !== undefined) data.authors = normalizeAuthors(input.authors) as unknown as Prisma.InputJsonValue;
  if (input.references !== undefined) data.references = normalizeRefs(input.references) as unknown as Prisma.InputJsonValue;
  if (input.featuredImage !== undefined) data.featuredImage = input.featuredImage ?? null;
  if (input.license !== undefined) data.license = input.license;
  await client.researchBulletin.update({ where: { id }, data });
}

export interface ReadinessCheck {
  key: string;
  label: string;
  ok: boolean;
}

/** Publication-readiness checklist (§25). */
export function bulletinReadiness(b: {
  title: string;
  abstract: string;
  category: string;
  keywords: string[];
  bodyHtml: string;
  authors: unknown;
  references: unknown;
}): { checks: ReadinessCheck[]; ready: boolean } {
  const authors = Array.isArray(b.authors) ? (b.authors as BulletinAuthor[]) : [];
  const refs = Array.isArray(b.references) ? (b.references as BulletinReference[]) : [];
  const bodyText = htmlToPlainText(b.bodyHtml);
  const checks: ReadinessCheck[] = [
    { key: 'title', label: 'Title', ok: b.title.trim().length >= 3 },
    { key: 'authors', label: 'At least one author', ok: authors.length > 0 },
    { key: 'abstract', label: 'Abstract', ok: b.abstract.trim().length >= 40 },
    { key: 'keywords', label: 'Keywords', ok: b.keywords.length >= 1 },
    { key: 'category', label: 'Category', ok: b.category.trim().length > 0 },
    { key: 'content', label: 'Main content', ok: bodyText.length >= 200 },
    { key: 'references', label: 'References', ok: refs.length >= 1 },
  ];
  return { checks, ready: checks.every((c) => c.ok) };
}

/** Publish a bulletin: assign the next permanent number (once) + publication date. */
export async function publishBulletin(id: string, client: PrismaClient = prisma): Promise<{ number: number; slug: string }> {
  return client.$transaction(async (tx) => {
    const b = await tx.researchBulletin.findUnique({ where: { id } });
    if (!b) throw notFound('Bulletin not found.');
    const readiness = bulletinReadiness(b);
    if (!readiness.ready) {
      const missing = readiness.checks.filter((c) => !c.ok).map((c) => c.label).join(', ');
      throw badRequest(`Not ready to publish. Missing: ${missing}.`);
    }
    // Assign a permanent number only the first time it is published.
    let number = b.number;
    if (number == null) {
      const max = await tx.researchBulletin.aggregate({ _max: { number: true } });
      number = (max._max.number ?? 0) + 1;
    }
    await tx.researchBulletin.update({
      where: { id },
      data: {
        number,
        status: 'published',
        publicationDate: b.publicationDate ?? new Date(),
      },
    });
    // Record internal citation edges from the body (knowledge graph, §15/§16).
    await syncBulletinCitations(id, b.bodyHtml, tx as PrismaClient);
    return { number: number!, slug: b.slug };
  });
}

export async function setBulletinStatus(id: string, status: BulletinStatus, client: PrismaClient = prisma): Promise<void> {
  const b = await client.researchBulletin.findUnique({ where: { id }, select: { id: true } });
  if (!b) throw notFound('Bulletin not found.');
  await client.researchBulletin.update({ where: { id }, data: { status } });
}

export type BulletinDetail = Prisma.ResearchBulletinGetPayload<Record<string, never>>;

/** Public read by slug — only published bulletins are exposed. */
export async function getPublishedBulletinBySlug(slug: string, client: PrismaClient = prisma): Promise<BulletinDetail | null> {
  return client.researchBulletin.findFirst({ where: { slug, status: 'published' } });
}

/** Public read by series number. */
export async function getPublishedBulletinByNumber(number: number, client: PrismaClient = prisma): Promise<BulletinDetail | null> {
  return client.researchBulletin.findFirst({ where: { number, status: 'published' } });
}

/** Any-status read by id (admin). */
export async function getBulletinById(id: string, client: PrismaClient = prisma): Promise<BulletinDetail | null> {
  return client.researchBulletin.findUnique({ where: { id } });
}

export interface BulletinListItem {
  number: number | null;
  slug: string;
  title: string;
  subtitle: string | null;
  type: BulletinType;
  category: string;
  abstract: string;
  keywords: string[];
  featuredImage: string | null;
  publicationDate: Date | null;
  viewCount: number;
  authors: BulletinAuthor[];
}

function toListItem(b: BulletinDetail): BulletinListItem {
  return {
    number: b.number,
    slug: b.slug,
    title: b.title,
    subtitle: b.subtitle,
    type: b.type,
    category: b.category,
    abstract: b.abstract,
    keywords: b.keywords,
    featuredImage: b.featuredImage,
    publicationDate: b.publicationDate,
    viewCount: b.viewCount,
    authors: Array.isArray(b.authors) ? (b.authors as unknown as BulletinAuthor[]) : [],
  };
}

/** Public listing for the hub, newest first, with optional filters + text query. */
export async function listPublishedBulletins(
  params: { query?: string; type?: BulletinType; category?: string; take?: number; skip?: number } = {},
  client: PrismaClient = prisma,
): Promise<{ items: BulletinListItem[]; total: number }> {
  const take = Math.min(params.take ?? 20, 100);
  const skip = params.skip ?? 0;
  const where: Prisma.ResearchBulletinWhereInput = {
    status: 'published',
    ...(params.type ? { type: params.type } : {}),
    ...(params.category ? { category: params.category } : {}),
    ...(params.query
      ? {
          OR: [
            { title: { contains: params.query, mode: 'insensitive' } },
            { abstract: { contains: params.query, mode: 'insensitive' } },
            { keywords: { has: params.query } },
          ],
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    client.researchBulletin.findMany({ where, orderBy: [{ publicationDate: 'desc' }, { number: 'desc' }], take, skip }),
    client.researchBulletin.count({ where }),
  ]);
  return { items: rows.map(toListItem), total };
}

/** Admin listing (all statuses). */
export async function listAllBulletins(client: PrismaClient = prisma): Promise<BulletinDetail[]> {
  return client.researchBulletin.findMany({ orderBy: [{ updatedAt: 'desc' }] });
}

/** All published slugs+dates for the sitemap. */
export async function listPublishedBulletinSlugs(client: PrismaClient = prisma): Promise<Array<{ slug: string; updatedAt: Date }>> {
  const rows = await client.researchBulletin.findMany({
    where: { status: 'published' },
    select: { slug: true, updatedAt: true },
    orderBy: { publicationDate: 'desc' },
  });
  return rows;
}

/** Distinct categories among published bulletins (for the hub filter). */
export async function listBulletinCategories(client: PrismaClient = prisma): Promise<string[]> {
  const rows = await client.researchBulletin.findMany({
    where: { status: 'published' },
    select: { category: true },
    distinct: ['category'],
    orderBy: { category: 'asc' },
  });
  return rows.map((r) => r.category);
}

/** Best-effort view increment (fire-and-forget from the page). */
export async function incrementBulletinView(id: string, client: PrismaClient = prisma): Promise<void> {
  await client.researchBulletin.update({ where: { id }, data: { viewCount: { increment: 1 } } }).catch(() => {});
}

/** Best-effort download increment (fire-and-forget from the PDF route). */
export async function incrementBulletinDownload(id: string, client: PrismaClient = prisma): Promise<void> {
  await client.researchBulletin.update({ where: { id }, data: { downloadCount: { increment: 1 } } }).catch(() => {});
}

// --- Citation ---------------------------------------------------------------

function splitName(name: string): { given?: string; family?: string; literal?: string } {
  if (name.includes(',')) {
    const [family, given] = name.split(',', 2).map((s) => s.trim());
    return { family, given };
  }
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return { given: parts.slice(0, -1).join(' '), family: parts[parts.length - 1] };
  return { literal: name.trim() };
}

/** Bibliographic data for a bulletin — the basis for every citation format. */
export function bulletinCitationData(b: BulletinDetail, appUrl: string): CitationData {
  const authors = (Array.isArray(b.authors) ? (b.authors as unknown as BulletinAuthor[]) : []).map((a) => splitName(a.name));
  const year = b.publicationDate ? b.publicationDate.getUTCFullYear() : undefined;
  return {
    title: b.title,
    authors: authors.length > 0 ? authors : [{ literal: SERIES_PUBLISHER }],
    year,
    journalTitle: b.number != null ? `${SERIES_NAME}, No. ${b.number}` : SERIES_NAME,
    publisher: SERIES_PUBLISHER,
    doi: b.doi ?? undefined,
    url: `${appUrl.replace(/\/$/, '')}/research-bulletin/${b.slug}`,
  };
}

/** The human-readable APA "Suggested citation" line (§18). */
export function suggestedCitation(b: BulletinDetail, appUrl: string): string {
  return formatCitation(bulletinCitationData(b, appUrl), 'apa');
}

/** Render a bulletin citation in any supported format. */
export function bulletinCitation(b: BulletinDetail, appUrl: string, format: CitationFormat): string {
  return formatCitation(bulletinCitationData(b, appUrl), format);
}

// --- Knowledge network (§15, §16, §17, §30) --------------------------------

/** Extract internal-bulletin slugs referenced by links in the body HTML. */
export function extractInternalCitationSlugs(bodyHtml: string): string[] {
  const slugs = new Set<string>();
  const re = /href\s*=\s*["'](?:https?:\/\/[^/"']+)?\/research-bulletin\/([a-z0-9-]+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(bodyHtml)) !== null) slugs.add(m[1]!.toLowerCase());
  return [...slugs];
}

/**
 * Reconcile a bulletin's outgoing internal-citation edges from links in its
 * body. Resolves each referenced slug to a published bulletin, skips
 * self-citation, and removes stale edges. Idempotent.
 */
export async function syncBulletinCitations(
  citingId: string,
  bodyHtml: string,
  client: PrismaClient = prisma,
): Promise<{ edges: number }> {
  const slugs = extractInternalCitationSlugs(bodyHtml);
  const targets = slugs.length
    ? await client.researchBulletin.findMany({
        where: { slug: { in: slugs }, status: 'published', id: { not: citingId } },
        select: { id: true },
      })
    : [];
  const citedIds = targets.map((t) => t.id);

  await client.bulletinCitation.deleteMany({
    where: { citingId, ...(citedIds.length ? { citedId: { notIn: citedIds } } : {}) },
  });
  for (const citedId of citedIds) {
    await client.bulletinCitation
      .create({ data: { citingId, citedId } })
      .catch(() => {}); // unique(citing,cited) → ignore dup
  }
  return { edges: citedIds.length };
}

/** Bulletins that cite THIS one — the public "Cited by" list (published only). */
export async function listCitedBy(bulletinId: string, client: PrismaClient = prisma): Promise<BulletinListItem[]> {
  const edges = await client.bulletinCitation.findMany({
    where: { citedId: bulletinId, citing: { status: 'published' } },
    include: { citing: true },
    orderBy: { createdAt: 'desc' },
  });
  return edges.map((e) => toListItem(e.citing));
}

/** Bulletins THIS one cites (published only). */
export async function listOutgoingCitations(bulletinId: string, client: PrismaClient = prisma): Promise<BulletinListItem[]> {
  const edges = await client.bulletinCitation.findMany({
    where: { citingId: bulletinId, cited: { status: 'published' } },
    include: { cited: true },
  });
  return edges.map((e) => toListItem(e.cited));
}

/**
 * Related bulletins (§17): other published bulletins sharing keywords, category,
 * or a citation edge with this one, ranked by overlap then recency.
 */
export async function relatedBulletins(
  bulletinId: string,
  limit = 5,
  client: PrismaClient = prisma,
): Promise<BulletinListItem[]> {
  const b = await client.researchBulletin.findUnique({
    where: { id: bulletinId },
    select: { keywords: true, category: true, type: true },
  });
  if (!b) return [];
  const candidates = await client.researchBulletin.findMany({
    where: {
      status: 'published',
      id: { not: bulletinId },
      OR: [
        { keywords: { hasSome: b.keywords } },
        { category: b.category },
        { citesOut: { some: { citedId: bulletinId } } },
        { citedBy: { some: { citingId: bulletinId } } },
      ],
    },
    take: 50,
    orderBy: { publicationDate: 'desc' },
  });
  const scored = candidates
    .map((c) => {
      const shared = c.keywords.filter((k) => b.keywords.includes(k)).length;
      const score = shared * 3 + (c.category === b.category ? 2 : 0) + (c.type === b.type ? 1 : 0);
      return { c, score };
    })
    .sort((x, y) => y.score - x.score || (y.c.publicationDate?.getTime() ?? 0) - (x.c.publicationDate?.getTime() ?? 0))
    .slice(0, limit);
  return scored.map((s) => toListItem(s.c));
}

// --- Authors (§22, §23) -----------------------------------------------------

/** Stable slug for an author name, used for the public author page URL. */
export function authorSlug(name: string): string {
  return slugify(name);
}

export interface BulletinAuthorProfile {
  name: string;
  slug: string;
  affiliation: string | null;
  orcid: string | null;
  bulletins: BulletinListItem[];
}

/**
 * Aggregate a public author profile by name-slug: their published bulletins and
 * the most complete affiliation/ORCID seen across them. v1 scans published
 * bulletins in-app (author list is JSON); normalize when volume warrants.
 */
export async function getBulletinAuthorProfile(slug: string, client: PrismaClient = prisma): Promise<BulletinAuthorProfile | null> {
  const rows = await client.researchBulletin.findMany({ where: { status: 'published' }, orderBy: { publicationDate: 'desc' } });
  let name = '';
  let affiliation: string | null = null;
  let orcid: string | null = null;
  const bulletins: BulletinListItem[] = [];
  for (const r of rows) {
    const authors = Array.isArray(r.authors) ? (r.authors as unknown as BulletinAuthor[]) : [];
    const match = authors.find((a) => authorSlug(a.name) === slug);
    if (!match) continue;
    if (!name) name = match.name;
    if (!affiliation && match.affiliation) affiliation = match.affiliation;
    if (!orcid && match.orcid) orcid = match.orcid;
    bulletins.push(toListItem(r));
  }
  if (bulletins.length === 0) return null;
  return { name, slug, affiliation, orcid, bulletins };
}

// --- Scholarly infrastructure: series config + DOI (§20, §21, §50) ----------

export interface SeriesConfig {
  name: string;
  publisher: string;
  /** Present only when a real ISSN/eISSN has been registered — never fabricated. */
  issn: string | null;
  eissn: string | null;
  frequency: string;
  language: string;
  country: string | null;
  description: string;
}

/**
 * Publication-series metadata (§21, §50). ISSN/eISSN come from env and are shown
 * ONLY when actually registered — the interface accommodates them without ever
 * implying an ISSN that does not exist.
 */
export function seriesConfig(env: NodeJS.ProcessEnv = process.env): SeriesConfig {
  return {
    name: SERIES_NAME,
    publisher: SERIES_PUBLISHER,
    issn: env.BULLETIN_ISSN?.trim() || null,
    eissn: env.BULLETIN_EISSN?.trim() || null,
    frequency: env.BULLETIN_FREQUENCY?.trim() || 'Continuous',
    language: env.BULLETIN_LANGUAGE?.trim() || 'en',
    country: env.BULLETIN_COUNTRY?.trim() || null,
    description: 'A scholarly research communication series published by ResearchTrics.',
  };
}

export type DoiProvider = 'zenodo' | 'datacite' | null;

/** Which DOI backend is active: Zenodo (free, preferred) → DataCite → none. */
export function bulletinDoiProvider(env: NodeJS.ProcessEnv = process.env): DoiProvider {
  if (isZenodoConfigured(env)) return 'zenodo';
  if (isDataCiteMintConfigured(env)) return 'datacite';
  return null;
}

/** True when any DOI backend is configured. */
export function isBulletinDoiEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return bulletinDoiProvider(env) !== null;
}

export interface MintBulletinDoiResult {
  doi: string;
  status: 'minted' | 'exists';
  state: string;
  provider: 'zenodo' | 'datacite';
}

/**
 * Mint a DOI for a published bulletin (§20). Prefers Zenodo (free, no
 * membership; requires the PDF as the deposited file) and falls back to
 * DataCite. Credential-gated and idempotent (a bulletin that already has a DOI
 * is returned unchanged). Stores doi/doiStatus/doiRegisteredAt. A DOI is never
 * displayed unless it was actually registered.
 */
export async function mintBulletinDoi(
  bulletinId: string,
  opts: { publish?: boolean; appUrl?: string; fetchImpl?: typeof fetch; pdf?: Uint8Array } = {},
  client: PrismaClient = prisma,
): Promise<MintBulletinDoiResult> {
  const provider = bulletinDoiProvider();
  if (!provider) {
    throw badRequest(
      'DOI minting is not configured on this server. Set ZENODO_TOKEN (free) or the DATACITE_* variables.',
    );
  }
  const b = await client.researchBulletin.findUnique({ where: { id: bulletinId } });
  if (!b) throw notFound('Bulletin not found.');
  if (b.status !== 'published') throw badRequest('Publish the bulletin before minting a DOI.');
  if (b.doi) return { doi: b.doi, status: 'exists', state: b.doiStatus ?? 'existing', provider };

  const appUrl = (opts.appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.researchtrics.com').replace(/\/$/, '');
  const landingUrl = `${appUrl}/research-bulletin/${b.slug}`;
  const publish = opts.publish ?? true;
  const authors = Array.isArray(b.authors) ? (b.authors as unknown as BulletinAuthor[]) : [];

  let doi: string;
  let state: string;
  if (provider === 'zenodo') {
    if (!opts.pdf) throw badRequest('The bulletin PDF is required to deposit to Zenodo.');
    const zres = await mintZenodoDoi(
      zenodoConfigFromEnv()!,
      {
        title: b.title,
        description: b.abstract,
        creators: authors.map((a) => ({ name: a.name, affiliation: a.affiliation, orcid: a.orcid })),
        publicationDate: b.publicationDate ? b.publicationDate.toISOString().slice(0, 10) : undefined,
        keywords: b.keywords,
        url: landingUrl,
        file: opts.pdf,
        filename: `research-bulletin-${b.number ?? b.slug}.pdf`,
      },
      opts.fetchImpl,
    );
    doi = zres.doi;
    state = zres.state;
  } else {
    const config = dataCiteConfigFromEnv()!;
    const attributes = buildDataCiteAttributes(
      {
        title: b.title,
        slug: b.slug,
        outputType: 'research_report',
        abstract: b.abstract,
        publishedYear: b.publicationDate ? b.publicationDate.getUTCFullYear() : null,
        publisher: SERIES_PUBLISHER,
        journalName: b.number != null ? `${SERIES_NAME}, No. ${b.number}` : SERIES_NAME,
        authors: authors.map((a) => ({ rawName: a.name, givenName: null, familyName: null, orcid: a.orcid ?? null })),
      },
      landingUrl,
      config.prefix,
      publish,
    );
    const dres = await submitDataCiteDoi(config, attributes, publish, opts.fetchImpl);
    doi = dres.doi;
    state = dres.state;
  }

  await client.researchBulletin.update({
    where: { id: bulletinId },
    data: { doi: doi.toLowerCase(), doiStatus: state, doiRegisteredAt: new Date() },
  });
  logger.info({ bulletinId, doi, state, provider }, 'Bulletin DOI minted');
  return { doi, status: 'minted', state, provider };
}
