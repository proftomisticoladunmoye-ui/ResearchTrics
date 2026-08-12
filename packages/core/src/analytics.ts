import { createHash } from 'node:crypto';
import { prisma, type PrismaClient, type AnalyticsEventType } from '@researchtrics/db';

export type { AnalyticsEventType } from '@researchtrics/db';

/**
 * Research analytics (Spec §41). Distinguishes interaction kinds, filters bots,
 * and never stores raw IPs — only a rotating pseudonymous visitor hash (Spec
 * §36, §65). Bot events are recorded but flagged and excluded from human counts.
 */

/** Bot / crawler User-Agent detection (Spec §41). Pure + tested. */
const BOT_RE =
  /(bot|crawler|spider|crawl|slurp|mediapartners|facebookexternalhit|embedly|quora link preview|bufferbot|whatsapp|telegrambot|preview|scrapy|curl|wget|python-requests|httpclient|headless|phantom|lighthouse|monitor|uptime|pingdom|semrush|ahrefs|mj12|dotbot|petalbot|bytespider|gptbot|ccbot|claudebot|google-inspectiontool|bingpreview)/i;

export function isBotUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent) return true; // no UA → treat as non-human
  return BOT_RE.test(userAgent);
}

/**
 * Pseudonymous visitor hash from IP + UA, salted per-UTC-day so it rotates
 * daily and cannot be reversed to an IP (Spec §36). Pure given the day salt.
 */
export function visitorHash(
  ip: string | null | undefined,
  userAgent: string | null | undefined,
  day: string = new Date().toISOString().slice(0, 10),
): string {
  return createHash('sha256').update(`${day}|${ip ?? 'noip'}|${userAgent ?? 'noua'}`).digest('hex');
}

export function referrerHost(referrer: string | null | undefined): string | null {
  if (!referrer) return null;
  try {
    return new URL(referrer).host || null;
  } catch {
    return null;
  }
}

export interface RecordEventInput {
  eventType: AnalyticsEventType;
  entityType: string;
  entityId: string;
  userAgent?: string | null;
  ip?: string | null;
  referrer?: string | null;
  /** Skip de-duplication (e.g. explicit download actions). */
  dedupeWindowMinutes?: number;
}

/**
 * Record an interaction. Bots are flagged (not dropped). Repeat human views of
 * the same entity by the same visitor within the dedupe window are ignored so
 * counts approximate unique engagement (Spec §41, §65).
 */
export async function recordEvent(
  input: RecordEventInput,
  client: PrismaClient = prisma,
): Promise<void> {
  const isBot = isBotUserAgent(input.userAgent);
  const vhash = visitorHash(input.ip, input.userAgent);
  const windowMin = input.dedupeWindowMinutes ?? 30;

  if (!isBot && windowMin > 0) {
    const since = new Date(Date.now() - windowMin * 60_000);
    const recent = await client.analyticsEvent.findFirst({
      where: {
        entityType: input.entityType,
        entityId: input.entityId,
        eventType: input.eventType,
        visitorHash: vhash,
        isBot: false,
        occurredAt: { gte: since },
      },
      select: { id: true },
    });
    if (recent) return; // already counted this visitor recently
  }

  await client.analyticsEvent.create({
    data: {
      eventType: input.eventType,
      entityType: input.entityType,
      entityId: input.entityId,
      visitorHash: isBot ? null : vhash,
      isBot,
      referrerHost: referrerHost(input.referrer),
    },
  });
}

/** Human counts per event type for one entity (bots excluded). */
export async function getEntityMetrics(
  entityType: string,
  entityId: string,
  client: PrismaClient = prisma,
): Promise<Record<string, number>> {
  const rows = await client.analyticsEvent.groupBy({
    by: ['eventType'],
    where: { entityType, entityId, isBot: false },
    _count: { _all: true },
  });
  const out: Record<string, number> = {};
  for (const r of rows) out[r.eventType] = r._count._all;
  return out;
}

/** Light engagement totals for a researcher — used to feed the RVM engine. */
export async function getResearcherEngagement(
  researcherId: string,
  client: PrismaClient = prisma,
): Promise<{ views: number; downloads: number }> {
  const pubIds = (
    await client.publication.findMany({
      where: { deletedAt: null, authors: { some: { researcherId } } },
      select: { id: true },
    })
  ).map((p) => p.id);

  const [profileViews, pubAgg] = await Promise.all([
    client.analyticsEvent.count({
      where: { entityType: 'researcher', entityId: researcherId, eventType: 'profile_view', isBot: false },
    }),
    pubIds.length
      ? client.analyticsEvent.groupBy({
          by: ['eventType'],
          where: { entityType: 'publication', entityId: { in: pubIds }, isBot: false, eventType: { in: ['publication_view', 'download'] } },
          _count: { _all: true },
        })
      : Promise.resolve([]),
  ]);
  const map: Record<string, number> = {};
  for (const r of pubAgg) map[r.eventType] = r._count._all;
  return { views: profileViews + (map.publication_view ?? 0), downloads: map.download ?? 0 };
}

export interface ResearcherAnalytics {
  profileViews: number;
  publicationViews: number;
  downloads: number;
  citationExports: number;
  citationTotal: number;
  publicationCount: number;
  /** Daily human view counts for the last N days (profile + publication views). */
  viewTrend: Array<{ day: string; views: number }>;
  topPublications: Array<{ slug: string; title: string; views: number }>;
}

export async function getResearcherAnalytics(
  researcherId: string,
  days = 30,
  client: PrismaClient = prisma,
): Promise<ResearcherAnalytics> {
  const pubs = await client.publication.findMany({
    where: { deletedAt: null, authors: { some: { researcherId } } },
    select: { id: true, slug: true, title: true, citationCounts: { select: { count: true } } },
  });
  const pubIds = pubs.map((p) => p.id);

  const profileMetrics = await getEntityMetrics('researcher', researcherId, client);

  // Aggregate publication-scoped events across the researcher's publications.
  const [pubEvents, topRows] = await Promise.all([
    pubIds.length
      ? client.analyticsEvent.groupBy({
          by: ['eventType'],
          where: { entityType: 'publication', entityId: { in: pubIds }, isBot: false },
          _count: { _all: true },
        })
      : Promise.resolve([]),
    pubIds.length
      ? client.analyticsEvent.groupBy({
          by: ['entityId'],
          where: { entityType: 'publication', entityId: { in: pubIds }, eventType: 'publication_view', isBot: false },
          _count: { _all: true },
        })
      : Promise.resolve([]),
  ]);
  const pubEventMap: Record<string, number> = {};
  for (const r of pubEvents) pubEventMap[r.eventType] = r._count._all;

  const bySlug = new Map(pubs.map((p) => [p.id, p]));
  const topPublications = topRows
    .map((r) => ({ pub: bySlug.get(r.entityId), views: r._count._all }))
    .filter((x): x is { pub: (typeof pubs)[number]; views: number } => !!x.pub)
    .sort((a, b) => b.views - a.views)
    .slice(0, 5)
    .map((x) => ({ slug: x.pub.slug, title: x.pub.title, views: x.views }));

  const citationTotal = pubs.reduce(
    (sum, p) => sum + Math.max(0, ...p.citationCounts.map((c) => c.count), 0),
    0,
  );

  // Daily view trend from raw events (profile + publication views).
  const since = new Date(Date.now() - days * 86_400_000);
  const viewEvents = await client.analyticsEvent.findMany({
    where: {
      isBot: false,
      eventType: { in: ['profile_view', 'publication_view'] },
      occurredAt: { gte: since },
      OR: [
        { entityType: 'researcher', entityId: researcherId },
        ...(pubIds.length ? [{ entityType: 'publication', entityId: { in: pubIds } }] : []),
      ],
    },
    select: { occurredAt: true },
  });
  const trendMap = new Map<string, number>();
  for (const e of viewEvents) {
    const day = e.occurredAt.toISOString().slice(0, 10);
    trendMap.set(day, (trendMap.get(day) ?? 0) + 1);
  }
  const viewTrend = buildDaySeries(days, trendMap);

  return {
    profileViews: profileMetrics.profile_view ?? 0,
    publicationViews: pubEventMap.publication_view ?? 0,
    downloads: pubEventMap.download ?? 0,
    citationExports: pubEventMap.citation_export ?? 0,
    citationTotal,
    publicationCount: pubs.length,
    viewTrend,
    topPublications,
  };
}

export interface InstitutionAnalytics {
  researcherCount: number;
  publicationCount: number;
  citationTotal: number;
  publicationViews: number;
}

export async function getInstitutionAnalytics(
  institutionId: string,
  client: PrismaClient = prisma,
): Promise<InstitutionAnalytics> {
  const affiliations = await client.affiliation.findMany({
    where: { institutionId, researcher: { deletedAt: null } },
    select: { researcherId: true },
  });
  const researcherIds = Array.from(new Set(affiliations.map((a) => a.researcherId)));

  if (researcherIds.length === 0) {
    return { researcherCount: 0, publicationCount: 0, citationTotal: 0, publicationViews: 0 };
  }

  const pubs = await client.publication.findMany({
    where: { deletedAt: null, authors: { some: { researcherId: { in: researcherIds } } } },
    select: { id: true, citationCounts: { select: { count: true } } },
  });
  const pubIds = pubs.map((p) => p.id);
  const citationTotal = pubs.reduce(
    (s, p) => s + Math.max(0, ...p.citationCounts.map((c) => c.count), 0),
    0,
  );
  const views = pubIds.length
    ? await client.analyticsEvent.count({
        where: { entityType: 'publication', entityId: { in: pubIds }, eventType: 'publication_view', isBot: false },
      })
    : 0;

  return {
    researcherCount: researcherIds.length,
    publicationCount: pubs.length,
    citationTotal,
    publicationViews: views,
  };
}

function buildDaySeries(days: number, counts: Map<string, number>): Array<{ day: string; views: number }> {
  const series: Array<{ day: string; views: number }> = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
    series.push({ day, views: counts.get(day) ?? 0 });
  }
  return series;
}
