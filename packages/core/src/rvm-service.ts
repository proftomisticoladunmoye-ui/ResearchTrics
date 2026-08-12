import { prisma, type PrismaClient } from '@researchtrics/db';
import { computeRvm, RVM_VERSION, type RvmInput, type RvmResult, type DimensionScore } from './rvm';
import { getResearcherEngagement } from './analytics';

/**
 * RVM data gathering + persistence (Spec §23, §30, §31). Signals are read from
 * the researcher's records; the pure engine (rvm.ts) turns them into a
 * transparent score. Recommendations and profile completeness are derived from
 * the same signals so the researcher always knows what would move the needle.
 */

// ---------- Profile completeness (Spec §31) ----------

export interface CompletenessItem {
  key: string;
  label: string;
  done: boolean;
}
export interface Completeness {
  percent: number;
  items: CompletenessItem[];
}

function computeCompleteness(
  researcher: { biography: string | null; country: string | null; academicRank: string | null; website: string | null; photoUrl: string | null },
  flags: { hasOrcid: boolean; hasInterests: boolean; hasAffiliation: boolean; hasPublications: boolean },
): Completeness {
  const items: CompletenessItem[] = [
    { key: 'biography', label: 'Biography', done: !!researcher.biography },
    { key: 'country', label: 'Country', done: !!researcher.country },
    { key: 'rank', label: 'Academic rank', done: !!researcher.academicRank },
    { key: 'website', label: 'Website', done: !!researcher.website },
    { key: 'photo', label: 'Profile photo', done: !!researcher.photoUrl },
    { key: 'orcid', label: 'ORCID connected', done: flags.hasOrcid },
    { key: 'interests', label: 'Research interests', done: flags.hasInterests },
    { key: 'affiliation', label: 'Institutional affiliation', done: flags.hasAffiliation },
    { key: 'publications', label: 'At least one publication', done: flags.hasPublications },
  ];
  const done = items.filter((i) => i.done).length;
  return { percent: Math.round((done / items.length) * 100), items };
}

// ---------- Recommendations (Spec §30) ----------

export interface Recommendation {
  key: string;
  title: string;
  priority: number; // higher = more impactful
  action?: { href: string; label: string };
}

function buildRecommendations(input: RvmInput, completeness: Completeness): Recommendation[] {
  const recs: Recommendation[] = [];
  const add = (key: string, title: string, priority: number, action?: Recommendation['action']) =>
    recs.push(action ? { key, title, priority, action } : { key, title, priority });

  if (!input.hasOrcid)
    add('orcid', 'Connect your ORCID iD to verify your identity', 100, { href: '/dashboard/profile', label: 'Connect ORCID' });
  if (input.publicationCount === 0)
    add('import', 'Import your publications by DOI', 95, { href: '/dashboard/publications', label: 'Import publications' });
  if (input.publicationCount > 0 && input.withDoiCount < input.publicationCount)
    add('dois', `Add DOIs to ${input.publicationCount - input.withDoiCount} publication(s)`, 80);
  if (input.publicationCount > 0 && input.withAbstractCount < input.publicationCount)
    add('abstracts', 'Add missing abstracts to improve discoverability', 70);
  if (input.publicationCount > 0 && input.openAccessCount === 0)
    add('oa', 'Mark or upload legally permitted open-access full text', 65);
  if (!completeness.items.find((i) => i.key === 'interests')?.done)
    add('interests', 'Add research interests to your profile', 60, { href: '/dashboard/profile', label: 'Edit profile' });
  if (!completeness.items.find((i) => i.key === 'biography')?.done)
    add('bio', 'Complete your biography', 55, { href: '/dashboard/profile', label: 'Edit profile' });
  if (!input.hasInstitutionalAffiliation)
    add('affiliation', 'Add your institutional affiliation', 50, { href: '/dashboard/profile', label: 'Edit profile' });
  if (input.connectedOutputs === 0)
    add('outputs', 'Link datasets, instruments, or software to your work', 45, { href: '/dashboard/outputs', label: 'Add outputs' });
  if (input.externalIdCount < 2)
    add('ids', 'Connect additional scholarly identifiers', 30);

  return recs.sort((a, b) => b.priority - a.priority);
}

// ---------- Gather ----------

export interface RvmBundle {
  input: RvmInput;
  completeness: Completeness;
  recommendations: Recommendation[];
}

export async function gatherRvmInput(
  researcherId: string,
  client: PrismaClient = prisma,
): Promise<RvmBundle> {
  const researcher = await client.researcher.findUnique({
    where: { id: researcherId },
    include: {
      identifiers: true,
      interests: true,
      affiliations: { include: { institution: { select: { country: true } } } },
      orcidConnection: { select: { id: true } },
      _count: { select: { datasetsCreated: true, instrumentsAuthored: true, softwareAuthored: true, projectsLed: true } },
    },
  });
  if (!researcher) throw new Error('Researcher not found');

  const publications = await client.publication.findMany({
    where: { deletedAt: null, authors: { some: { researcherId } } },
    include: { identifiers: true, citationCounts: true, authors: { select: { researcherId: true } } },
  });

  const withDoiCount = publications.filter((p) => p.identifiers.some((i) => i.scheme === 'doi')).length;
  const withAbstractCount = publications.filter((p) => !!p.abstract).length;
  const openAccessCount = publications.filter((p) => p.openAccess).length;
  const preprintCount = publications.filter((p) => p.outputType === 'preprint').length;
  const knowledgeTranslationCount = publications.filter(
    (p) => p.outputType === 'policy_brief' || p.outputType === 'research_brief',
  ).length;

  const citationTotal = publications.reduce(
    (sum, p) => sum + Math.max(0, ...p.citationCounts.map((c) => c.count), 0),
    0,
  );
  const sourceSet = new Set<string>();
  for (const p of publications) for (const c of p.citationCounts) sourceSet.add(c.source);

  const collaborators = new Set<string>();
  for (const p of publications)
    for (const a of p.authors)
      if (a.researcherId && a.researcherId !== researcherId) collaborators.add(a.researcherId);

  const institutionIds = new Set(researcher.affiliations.map((a) => a.institutionId));
  const countries = new Set<string>();
  if (researcher.country) countries.add(researcher.country);
  for (const a of researcher.affiliations) if (a.institution?.country) countries.add(a.institution.country);

  const datasetOpenCount = await client.dataset.count({
    where: { creatorResearcherId: researcherId, deletedAt: null, accessLevel: 'open' },
  });

  const engagement = await getResearcherEngagement(researcherId, client);
  const hasOrcid = !!researcher.orcidConnection || researcher.identifiers.some((i) => i.scheme === 'orcid' && i.verified);
  const connectedOutputs =
    researcher._count.datasetsCreated +
    researcher._count.instrumentsAuthored +
    researcher._count.softwareAuthored +
    researcher._count.projectsLed;

  const completeness = computeCompleteness(researcher, {
    hasOrcid,
    hasInterests: researcher.interests.length > 0,
    hasAffiliation: researcher.affiliations.length > 0,
    hasPublications: publications.length > 0,
  });

  const input: RvmInput = {
    publicationCount: publications.length,
    withDoiCount,
    withAbstractCount,
    openAccessCount,
    citationTotal,
    distinctCitationSources: sourceSet.size,
    collaboratorCount: collaborators.size,
    distinctInstitutionCount: institutionIds.size,
    distinctCountryCount: countries.size,
    connectedOutputs,
    datasetOpenCount,
    preprintCount,
    knowledgeTranslationCount,
    engagementViews: engagement.views,
    engagementDownloads: engagement.downloads,
    hasOrcid,
    externalIdCount: researcher.identifiers.length,
    hasWebsite: !!researcher.website,
    hasInstitutionalAffiliation: researcher.affiliations.length > 0,
    profileCompleteness: completeness.percent / 100,
  };

  return { input, completeness, recommendations: buildRecommendations(input, completeness) };
}

// ---------- Compute + store ----------

export interface StoredRvm {
  result: RvmResult;
  bundle: RvmBundle;
  previousOverall: number | null;
}

export async function computeAndStoreRvm(
  researcherId: string,
  client: PrismaClient = prisma,
): Promise<StoredRvm> {
  const bundle = await gatherRvmInput(researcherId, client);
  const result = computeRvm(bundle.input);

  const previous = await client.rvmScore.findFirst({
    where: { subjectType: 'researcher', subjectId: researcherId },
    orderBy: { calculatedAt: 'desc' },
    select: { overall: true },
  });

  await client.rvmScore.create({
    data: {
      subjectType: 'researcher',
      subjectId: researcherId,
      version: RVM_VERSION,
      overall: result.overall,
      dimensions: result.dimensions as unknown as object,
      confidence: result.confidence,
      missingData: result.missingData,
    },
  });

  return { result, bundle, previousOverall: previous?.overall ?? null };
}

/** Latest stored score, recomputing if older than `maxAgeMs` or absent. */
export async function getOrComputeRvm(
  researcherId: string,
  maxAgeMs = 1000 * 60 * 60 * 24,
  client: PrismaClient = prisma,
): Promise<StoredRvm> {
  const latest = await client.rvmScore.findFirst({
    where: { subjectType: 'researcher', subjectId: researcherId },
    orderBy: { calculatedAt: 'desc' },
  });

  if (latest && Date.now() - latest.calculatedAt.getTime() < maxAgeMs) {
    const bundle = await gatherRvmInput(researcherId, client);
    const previous = await client.rvmScore.findFirst({
      where: { subjectType: 'researcher', subjectId: researcherId, calculatedAt: { lt: latest.calculatedAt } },
      orderBy: { calculatedAt: 'desc' },
      select: { overall: true },
    });
    const result: RvmResult = {
      version: latest.version,
      overall: latest.overall,
      confidence: latest.confidence,
      dimensions: latest.dimensions as unknown as DimensionScore[],
      missingData: (latest.missingData as string[] | null) ?? [],
      calculatedAt: latest.calculatedAt.toISOString(),
      disclaimer:
        'RVM measures research visibility — not impact, and not quality. ResearchTrics proprietary research visibility framework (prototype, pending empirical validation).',
    };
    return { result, bundle, previousOverall: previous?.overall ?? null };
  }

  return computeAndStoreRvm(researcherId, client);
}
