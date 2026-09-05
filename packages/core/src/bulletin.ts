import { prisma, type PrismaClient, type Prisma, type BulletinType, type BulletinStatus } from '@researchtrics/db';

// Re-export the Prisma enum types so app code imports them from core (its single
// domain entry point) rather than reaching into the db package directly.
export type { BulletinType, BulletinStatus } from '@researchtrics/db';
import { slugWithSuffix } from './id';
import { badRequest, notFound } from './errors';
import { sanitizeBulletinHtml, htmlToPlainText } from './html-sanitize';
import { formatCitation, type CitationData, type CitationFormat } from './citation-export';

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
