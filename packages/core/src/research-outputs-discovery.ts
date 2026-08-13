import { prisma, type PrismaClient } from '@researchtrics/db';
import {
  createFederationProvider,
  type ScholarlyMetadataProvider,
  type NormalizedWork,
} from '@researchtrics/federation';
import { notFound } from './errors';

/**
 * Research-output discovery (addendum §24, §25, §26).
 *
 * For a researcher, searches a scholarly source (DataCite by default) for their
 * datasets and software and returns them as **candidates** — never claiming
 * ownership automatically (§25). The researcher reviews and claims/rejects. The
 * provider is injectable so this is unit-tested offline.
 */

export interface ResearchOutputDiscovery {
  /** ORCID used for the search, if the researcher has one. */
  orcid: string | null;
  /** Provider queried (e.g. 'datacite'). */
  provider: string;
  /** Candidate outputs — datasets/software, provenance-bearing, unclaimed. */
  outputs: NormalizedWork[];
}

export async function discoverResearchOutputs(
  researcherId: string,
  opts: { provider?: ScholarlyMetadataProvider; limit?: number } = {},
  client: PrismaClient = prisma,
): Promise<ResearchOutputDiscovery> {
  const researcher = await client.researcher.findUnique({
    where: { id: researcherId },
    include: { identifiers: true },
  });
  if (!researcher) throw notFound('Researcher not found');
  const orcid = researcher.identifiers.find((i) => i.scheme === 'orcid')?.value ?? null;

  const provider =
    opts.provider ??
    createFederationProvider('datacite', {
      datacite: { baseUrl: process.env.DATACITE_BASE_URL },
    });

  // Nothing to search on, or the provider can't search → no candidates.
  if (!provider.searchWorks || (!orcid && !researcher.displayName)) {
    return { orcid, provider: provider.name, outputs: [] };
  }

  const outputs = await provider.searchWorks({
    orcid: orcid ?? undefined,
    name: orcid ? undefined : researcher.displayName,
    resourceTypes: ['dataset', 'software'],
    limit: opts.limit ?? 25,
  });

  return { orcid, provider: provider.name, outputs };
}

/**
 * Biomedical research footprint (addendum §27). Searches PubMed for a
 * researcher's publications and returns them as candidates plus a simple
 * presence indicator + count. This is a **footprint, not a quality score** — it
 * never ranks or judges the research (§27).
 */
export interface BiomedicalFootprint {
  provider: string;
  count: number;
  /** 'present' when any PubMed records were found, else 'none'. Not a score. */
  indicator: 'present' | 'none';
  works: NormalizedWork[];
}

export async function getBiomedicalFootprint(
  researcherId: string,
  opts: { provider?: ScholarlyMetadataProvider; limit?: number } = {},
  client: PrismaClient = prisma,
): Promise<BiomedicalFootprint> {
  const researcher = await client.researcher.findUnique({
    where: { id: researcherId },
    select: { displayName: true, familyName: true, givenNames: true },
  });
  if (!researcher) throw notFound('Researcher not found');

  const provider =
    opts.provider ??
    createFederationProvider('pubmed', {
      pubmed: {
        baseUrl: process.env.PUBMED_BASE_URL,
        apiKey: process.env.PUBMED_API_KEY,
        tool: process.env.PUBMED_TOOL,
        email: process.env.PUBMED_EMAIL,
      },
    });

  if (!provider.searchWorks) return { provider: provider.name, count: 0, indicator: 'none', works: [] };

  const works = await provider.searchWorks({
    name: researcher.displayName,
    resourceTypes: ['publication'],
    limit: opts.limit ?? 25,
  });
  return {
    provider: provider.name,
    count: works.length,
    indicator: works.length > 0 ? 'present' : 'none',
    works,
  };
}
