import type {
  ResearcherDiscoveryProvider,
  DiscoveredResearcher,
  DiscoveryQuery,
} from './types';

/**
 * A deterministic, offline discovery provider (Discovery Engine §67).
 *
 * It serves a controlled fixture dataset — no network, no external API — so the
 * full discovery → identity → provisional-profile → claim workflow can be built
 * and validated before any large-scale live discovery is enabled. Live
 * providers (OpenAlex, Crossref, ORCID) arrive in the next slice behind the
 * same interface.
 */
export class FixtureDiscoveryProvider implements ResearcherDiscoveryProvider {
  readonly name = 'fixture';
  readonly external = false;

  constructor(private readonly dataset: DiscoveredResearcher[] = DEFAULT_FIXTURE) {}

  discover(query: DiscoveryQuery): Promise<DiscoveredResearcher[]> {
    const q = (s: string | undefined) => (s ?? '').trim().toLowerCase();
    let results = this.dataset.filter((r) => {
      if (query.orcid && r.orcid !== query.orcid) return false;
      if (query.institution && q(r.institution) !== q(query.institution)) return false;
      if (query.country && q(r.country) !== q(query.country)) return false;
      if (query.topic && !r.topics.some((t) => q(t) === q(query.topic))) return false;
      return true;
    });
    if (query.limit != null) results = results.slice(0, query.limit);
    return Promise.resolve(results);
  }
}

const now = () => new Date().toISOString();

/** A small controlled dataset (§67: 100–500 in practice; a few here for tests). */
export const DEFAULT_FIXTURE: DiscoveredResearcher[] = [
  {
    fullName: 'Jane A. Smith',
    nameVariants: ['Jane A. Smith', 'J. Smith', 'Smith, Jane A.'],
    orcid: '0000-0002-1111-2222',
    openalexAuthorId: 'A5000000001',
    institution: 'University X',
    country: 'GB',
    topics: ['psychometrics', 'educational assessment', 'measurement'],
    coauthors: ['Alan Turing', 'Grace Hopper'],
    publicationCount: 34,
    works: [
      { title: 'Measurement invariance in cross-cultural assessment', doi: '10.9999/fixt.1', year: 2019 },
      { title: 'Reliability of educational assessments', doi: '10.9999/fixt.2', year: 2021 },
    ],
    provenance: {
      source: 'fixture',
      sourceId: 'A5000000001',
      sourceUrl: 'https://openalex.org/A5000000001',
      retrievedAt: now(),
      confidence: 90,
    },
  },
  {
    fullName: 'Ravi Kumar',
    nameVariants: ['Ravi Kumar', 'R. Kumar'],
    openalexAuthorId: 'A5000000002',
    institution: 'Institute Y',
    country: 'IN',
    topics: ['bibliometrics', 'open science'],
    coauthors: ['Jane A. Smith'],
    publicationCount: 12,
    works: [{ title: 'Citation patterns in open science', doi: '10.9999/fixt.3', year: 2022 }],
    provenance: {
      source: 'fixture',
      sourceId: 'A5000000002',
      sourceUrl: 'https://openalex.org/A5000000002',
      retrievedAt: now(),
      confidence: 80,
    },
  },
];
