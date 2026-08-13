/**
 * Researcher Discovery types (Discovery Engine §1, §3, §36, §39).
 *
 * A discovery provider turns a legitimate scholarly source (OpenAlex, Crossref,
 * ORCID, OJS, …) into normalized *candidate* researchers. Every candidate and
 * every field carries provenance — nothing is presented without a source, and a
 * candidate is never treated as a verified identity (§68).
 */

/** Where a piece of discovered data came from. */
export interface DiscoveryProvenance {
  source: string; // 'openalex' | 'crossref' | 'orcid' | 'ojs' | ...
  sourceId?: string | undefined;
  sourceUrl?: string | undefined;
  retrievedAt: string; // ISO 8601
  /** 0..100 — the source's own confidence in this datum, if any. */
  confidence?: number | undefined;
}

/** A work associated with a discovered researcher (candidate publication). */
export interface DiscoveredWork {
  title: string;
  doi?: string | undefined;
  year?: number | undefined;
  sourceId?: string | undefined;
}

/** A researcher discovered from a scholarly source but NOT yet claimed. */
export interface DiscoveredResearcher {
  fullName: string;
  nameVariants: string[];
  orcid?: string | undefined;
  openalexAuthorId?: string | undefined;
  institution?: string | undefined;
  country?: string | undefined;
  topics: string[];
  works: DiscoveredWork[];
  coauthors: string[]; // names or ids as reported by the source
  publicationCount?: number | undefined;
  provenance: DiscoveryProvenance;
}

/** Parameters for a discovery query (Discovery Engine §22). */
export interface DiscoveryQuery {
  institution?: string | undefined;
  rorId?: string | undefined;
  country?: string | undefined;
  topic?: string | undefined;
  orcid?: string | undefined;
  /** Bounded — bulk discovery runs are batched by the caller (§23, §52). */
  limit?: number | undefined;
}

/** A legitimate scholarly discovery source (Discovery Engine §39). */
export interface ResearcherDiscoveryProvider {
  /** Provider name, surfaced in provenance and admin dashboards. */
  readonly name: string;
  /** True when this provider calls an external service (vs. a local fixture). */
  readonly external: boolean;
  /** Discover candidate researchers for a query. */
  discover(query: DiscoveryQuery): Promise<DiscoveredResearcher[]>;
}
