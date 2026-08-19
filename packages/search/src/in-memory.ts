import {
  SEARCHABLE_TYPES,
  relevanceScore,
  normalizePaging,
  type SearchIndex,
  type SearchQuery,
  type SearchResult,
  type SearchHit,
  type SearchableType,
  type SearchFacets,
} from './types';

/** Document backing the in-memory index (used in tests and small demos). */
export interface IndexedDoc extends Omit<SearchHit, 'score'> {
  /** Extra searchable text (e.g. abstract, interests). */
  body?: string;
  country?: string | null;
  year?: number | null;
  openAccess?: boolean;
  verified?: boolean;
}

/**
 * Reference SearchIndex over an in-memory array. Proves the interface and gives
 * deterministic tests; production uses the Postgres implementation.
 */
export class InMemorySearchIndex implements SearchIndex {
  constructor(private readonly docs: IndexedDoc[]) {}

  async search(query: SearchQuery): Promise<SearchResult> {
    const { page, pageSize, skip } = normalizePaging(query.page, query.pageSize);
    const f = query.filters ?? {};
    const typeSet = f.types && f.types.length > 0 ? new Set(f.types) : null;

    const scored = this.docs
      .filter((d) => (typeSet ? typeSet.has(d.type) : true))
      .filter((d) => (f.country ? d.country === f.country : true))
      .filter((d) => (f.yearFrom !== undefined ? (d.year ?? -Infinity) >= f.yearFrom : true))
      .filter((d) => (f.yearTo !== undefined ? (d.year ?? Infinity) <= f.yearTo : true))
      .filter((d) => (f.openAccess ? d.openAccess === true : true))
      .filter((d) => (f.verifiedOnly ? d.verified === true : true))
      .map((d) => {
        const score = Math.max(
          relevanceScore(d.title, query.q),
          relevanceScore(d.subtitle ?? '', query.q) * 0.7,
          relevanceScore(d.body ?? '', query.q) * 0.5,
        );
        return { d, score };
      })
      .filter((x) => (query.q ? x.score > 0 : true));

    scored.sort((a, b) => b.score - a.score || a.d.title.localeCompare(b.d.title));

    const facets = emptyFacets();
    for (const x of scored) facets.types[x.d.type] += 1;

    const items: SearchHit[] = scored.slice(skip, skip + pageSize).map((x) => ({
      type: x.d.type,
      id: x.d.id,
      title: x.d.title,
      ...(x.d.subtitle ? { subtitle: x.d.subtitle } : {}),
      url: x.d.url,
      ...(x.d.imageUrl ? { imageUrl: x.d.imageUrl } : {}),
      score: x.score,
      ...(x.d.meta ? { meta: x.d.meta } : {}),
    }));

    return { items, total: scored.length, page, pageSize, facets };
  }
}

export function emptyFacets(): SearchFacets {
  const types = {} as Record<SearchableType, number>;
  for (const t of SEARCHABLE_TYPES) types[t] = 0;
  return { types };
}
