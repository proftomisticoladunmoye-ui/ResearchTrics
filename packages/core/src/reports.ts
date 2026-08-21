import { prisma, type PrismaClient } from '@researchtrics/db';
import { getResearcherAnalytics } from './analytics';
import { getOrComputeRvm } from './rvm-service';
import { countFollowers } from './follow';
import { listResearcherPublications } from './profile';

/**
 * Impact / visibility report (§premium). A shareable snapshot of a researcher's
 * reach — reads, citations, followers, RVM, top works — assembled entirely from
 * verified platform data. The "deep" reach-by-country section is premium.
 */

export interface ImpactReport {
  researcher: {
    displayName: string;
    slug: string;
    researchtricsId: string;
    affiliation: string | null;
    country: string | null;
  };
  generatedAt: Date;
  windowDays: number;
  metrics: {
    publications: number;
    citations: number;
    publicationViews: number;
    profileViews: number;
    downloads: number;
    followers: number;
  };
  rvm: number | null;
  topPublications: Array<{
    slug: string;
    title: string;
    year: number | null;
    venue: string | null;
    citationCount: number | null;
  }>;
  /** Premium-only. null when not entitled. */
  reachByCountry: Array<{ country: string; count: number }> | null;
  deep: boolean;
}

export async function buildImpactReport(
  researcherId: string,
  opts: { deep?: boolean; windowDays?: number } = {},
  client: PrismaClient = prisma,
): Promise<ImpactReport> {
  const windowDays = opts.windowDays ?? 365;
  const deep = opts.deep ?? false;

  const researcher = await client.researcher.findUnique({
    where: { id: researcherId },
    select: {
      displayName: true,
      slug: true,
      researchtricsId: true,
      country: true,
      affiliations: {
        where: { isPrimary: true },
        include: { institution: { select: { name: true } } },
        take: 1,
      },
    },
  });
  if (!researcher) throw new Error('Researcher not found');

  const [analytics, followers, pubs, rvm] = await Promise.all([
    getResearcherAnalytics(researcherId, windowDays, client),
    countFollowers(researcherId, client),
    listResearcherPublications(researcherId, { take: 100 }, client),
    getOrComputeRvm(researcherId, undefined, client).then((r) => r.result.overall).catch(() => null),
  ]);

  const topPublications = [...pubs]
    .sort((a, b) => (b.citationCount ?? 0) - (a.citationCount ?? 0) || (b.year ?? 0) - (a.year ?? 0))
    .slice(0, 5)
    .map((p) => ({ slug: p.slug, title: p.title, year: p.year, venue: p.venue, citationCount: p.citationCount }));

  let reachByCountry: ImpactReport['reachByCountry'] = null;
  if (deep) {
    const rows = await client.notification.groupBy({
      by: ['country'],
      where: { recipientId: researcherId, country: { not: null } },
      _count: { _all: true },
    });
    reachByCountry = rows
      .map((r) => ({ country: r.country as string, count: r._count._all }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);
  }

  return {
    researcher: {
      displayName: researcher.displayName,
      slug: researcher.slug,
      researchtricsId: researcher.researchtricsId,
      affiliation: researcher.affiliations[0]?.institution?.name ?? null,
      country: researcher.country,
    },
    generatedAt: new Date(),
    windowDays,
    metrics: {
      publications: analytics.publicationCount,
      citations: analytics.citationTotal,
      publicationViews: analytics.publicationViews,
      profileViews: analytics.profileViews,
      downloads: analytics.downloads,
      followers,
    },
    rvm,
    topPublications,
    reachByCountry,
    deep,
  };
}
