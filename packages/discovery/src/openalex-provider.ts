import { politeFetchJson } from '@researchtrics/integration-shared';
import type {
  ResearcherDiscoveryProvider,
  DiscoveredResearcher,
  DiscoveryQuery,
} from './types';

/**
 * OpenAlex discovery provider (Discovery Engine §6, §39). Uses the public
 * OpenAlex Authors API as **evidence** for identity — never authoritative
 * (§37). Endpoints are env-configurable and should be re-verified against
 * https://api.openalex.org. Joins the polite pool via `mailto`, and the HTTP
 * layer is injectable so this is unit-tested offline with no network.
 */

export interface OpenAlexDiscoveryConfig {
  baseUrl?: string | undefined;
  mailto?: string | undefined;
  apiKey?: string | undefined;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Map one OpenAlex author object into a discovered candidate. Pure + tested. */
export function mapOpenAlexAuthor(author: unknown): DiscoveredResearcher {
  const a = author as any;
  const idUrl: string | undefined = typeof a?.id === 'string' ? a.id : undefined;
  const openalexAuthorId = idUrl ? idUrl.replace(/^https?:\/\/openalex\.org\//i, '') : undefined;
  const orcid =
    typeof a?.orcid === 'string' ? a.orcid.replace(/^https?:\/\/orcid\.org\//i, '') : undefined;

  const inst = Array.isArray(a?.last_known_institutions)
    ? a.last_known_institutions[0]
    : a?.last_known_institution;
  const institution = typeof inst?.display_name === 'string' ? inst.display_name : undefined;
  const country = typeof inst?.country_code === 'string' ? inst.country_code : undefined;

  const topicSource = Array.isArray(a?.topics)
    ? a.topics
    : Array.isArray(a?.x_concepts)
      ? a.x_concepts
      : [];
  const topics = topicSource
    .map((t: any) => (typeof t?.display_name === 'string' ? t.display_name : undefined))
    .filter((t: unknown): t is string => typeof t === 'string')
    .slice(0, 10);

  const fullName = typeof a?.display_name === 'string' ? a.display_name : 'Unknown researcher';
  const nameVariants = Array.isArray(a?.display_name_alternatives)
    ? [fullName, ...a.display_name_alternatives.filter((n: unknown) => typeof n === 'string')]
    : [fullName];

  const candidate: DiscoveredResearcher = {
    fullName,
    nameVariants: Array.from(new Set(nameVariants)),
    topics,
    works: [],
    coauthors: [],
    provenance: {
      source: 'openalex',
      sourceId: openalexAuthorId,
      sourceUrl: idUrl,
      retrievedAt: new Date().toISOString(),
    },
  };
  if (orcid) candidate.orcid = orcid;
  if (openalexAuthorId) candidate.openalexAuthorId = openalexAuthorId;
  if (institution) candidate.institution = institution;
  if (country) candidate.country = country;
  if (typeof a?.works_count === 'number') candidate.publicationCount = a.works_count;
  return candidate;
}

/** Build the OpenAlex Authors query URL from a discovery query. */
export function buildOpenAlexAuthorsUrl(query: DiscoveryQuery, config: OpenAlexDiscoveryConfig): string {
  const base = (config.baseUrl ?? 'https://api.openalex.org').replace(/\/$/, '');
  const filters: string[] = [];
  if (query.rorId) filters.push(`last_known_institutions.ror:${query.rorId}`);
  if (query.country) filters.push(`last_known_institutions.country_code:${query.country.toLowerCase()}`);
  if (query.orcid) filters.push(`orcid:${query.orcid}`);

  const params = new URLSearchParams();
  if (filters.length) params.set('filter', filters.join(','));
  // Name/topic/institution-name are best served by search rather than a filter.
  const search = query.topic ?? query.institution;
  if (search) params.set('search', search);
  params.set('per-page', String(Math.min(query.limit ?? 25, 200)));
  if (config.mailto) params.set('mailto', config.mailto);
  if (config.apiKey) params.set('api_key', config.apiKey);
  return `${base}/authors?${params.toString()}`;
}

export class OpenAlexDiscoveryProvider implements ResearcherDiscoveryProvider {
  readonly name = 'openalex';
  readonly external = true;

  constructor(
    private readonly config: OpenAlexDiscoveryConfig = {},
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async discover(query: DiscoveryQuery): Promise<DiscoveredResearcher[]> {
    const url = buildOpenAlexAuthorsUrl(query, this.config);
    const json = (await politeFetchJson(url, {
      mailto: this.config.mailto,
      fetchImpl: this.fetchImpl,
    })) as any;
    const results = Array.isArray(json?.results) ? json.results : [];
    return results.map(mapOpenAlexAuthor);
  }
}
