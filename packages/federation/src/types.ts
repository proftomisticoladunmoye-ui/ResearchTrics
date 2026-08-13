/**
 * Scholarly Metadata Federation types (addendum §2, §16, §34).
 *
 * `ScholarlyMetadataProvider` is a provider-agnostic superset of the discovery
 * provider: every legitimate source (Crossref, OpenAlex, DataCite, PubMed,
 * ORCID, OJS, ROR) is an adapter behind this interface. Not every provider
 * implements every method — `capabilities` declares support, and callers check
 * before invoking. The core never depends on a concrete provider.
 */

export type ProviderCapability =
  | 'search'
  | 'discover'
  | 'getWork'
  | 'getAuthor'
  | 'getInstitution'
  | 'getCitations'
  | 'getRelatedWorks'
  | 'healthCheck';

export type HealthStatus = 'healthy' | 'warning' | 'down';

export interface ProviderHealth {
  provider: string;
  status: HealthStatus;
  latencyMs?: number | undefined;
  checkedAt: string; // ISO 8601
  error?: string | undefined;
}

/** Persistent identifier used to fetch a specific record. */
export interface PersistentId {
  doi?: string | undefined;
  pmid?: string | undefined;
  openalex?: string | undefined;
  ror?: string | undefined;
  orcid?: string | undefined;
}

/** A researcher-scoped search for works/outputs (addendum §24–§26). */
export interface WorkSearchQuery {
  orcid?: string | undefined;
  name?: string | undefined;
  /** Restrict to these resource types (e.g. dataset, software). */
  resourceTypes?: ResourceType[] | undefined;
  limit?: number | undefined;
}

export type ResourceType =
  | 'publication'
  | 'dataset'
  | 'software'
  | 'report'
  | 'protocol'
  | 'instrument'
  | 'other';

/** External identifiers carried on a work — kept distinct per scheme (§16). */
export interface WorkExternalIds {
  doi?: string | undefined;
  pmid?: string | undefined;
  pmcid?: string | undefined;
  openalex?: string | undefined;
  datacite?: string | undefined;
  crossref?: string | undefined;
  ojs?: string | undefined;
}

export interface NormalizedWorkAuthor {
  rawName: string;
  orcid?: string | undefined;
  affiliation?: string | undefined;
}

/** A single provider's normalized view of a work, with provenance (§16, §38). */
export interface NormalizedWork {
  /** Provider that produced this record. */
  source: string;
  resourceType: ResourceType;
  title: string;
  abstract?: string | undefined;
  publishedYear?: number | undefined;
  publishedOn?: string | undefined;
  journalTitle?: string | undefined;
  publisher?: string | undefined;
  licenseCode?: string | undefined;
  externalIds: WorkExternalIds;
  authors: NormalizedWorkAuthor[];
  /** Source-specific citation count — NEVER merged across sources (§30). */
  citationCount?: number | undefined;
  provenance: {
    source: string;
    sourceId?: string | undefined;
    sourceUrl?: string | undefined;
    retrievedAt: string;
  };
  raw?: unknown;
}

/** A legitimate scholarly metadata source (addendum §2, §39). */
export interface ScholarlyMetadataProvider {
  readonly name: string;
  /** True when the provider calls an external service. */
  readonly external: boolean;
  /** Which optional methods this provider actually supports. */
  readonly capabilities: ProviderCapability[];
  /** Liveness + latency probe for the source-health dashboard (§34). */
  healthCheck(): Promise<ProviderHealth>;
  /** Fetch a single work by persistent identifier. */
  getWork?(id: PersistentId): Promise<NormalizedWork>;
  /** Search a source for a researcher's works/outputs (§24–§26). */
  searchWorks?(query: WorkSearchQuery): Promise<NormalizedWork[]>;
}
