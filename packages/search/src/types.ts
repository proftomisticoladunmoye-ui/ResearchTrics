/**
 * Search contracts (Spec §17, §47). The interface is engine-agnostic so the
 * Postgres implementation can later be swapped for OpenSearch without touching
 * callers. Semantic/vector search can be layered behind the same interface.
 */

export const SEARCHABLE_TYPES = [
  'researcher',
  'publication',
  'institution',
  'journal',
  'project',
  'dataset',
  'instrument',
  'software',
] as const;
export type SearchableType = (typeof SEARCHABLE_TYPES)[number];

export interface SearchFilters {
  /** Restrict to these entity types (default: all). */
  types?: SearchableType[];
  country?: string;
  yearFrom?: number;
  yearTo?: number;
  openAccess?: boolean;
  verifiedOnly?: boolean;
}

export interface SearchQuery {
  q: string;
  filters?: SearchFilters;
  page?: number;
  pageSize?: number;
}

export interface SearchHit {
  type: SearchableType;
  id: string;
  title: string;
  subtitle?: string;
  url: string;
  /** Optional thumbnail (e.g. a researcher's photo or an institution logo). */
  imageUrl?: string | null;
  score: number;
  meta?: Record<string, string | number | boolean | null>;
}

export interface SearchFacets {
  types: Record<SearchableType, number>;
}

export interface SearchResult {
  items: SearchHit[];
  total: number;
  page: number;
  pageSize: number;
  facets: SearchFacets;
}

export interface SearchIndex {
  search(query: SearchQuery): Promise<SearchResult>;
}

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;

/** Relevance score for a text match — exact/prefix/substring tiers. Pure. */
export function relevanceScore(field: string | null | undefined, q: string): number {
  if (!field) return 0;
  const f = field.toLowerCase();
  const query = q.toLowerCase().trim();
  if (!query) return 0;
  if (f === query) return 1;
  if (f.startsWith(query)) return 0.8;
  if (f.includes(` ${query}`)) return 0.6;
  if (f.includes(query)) return 0.4;
  return 0;
}

/** Clamp + normalize pagination. Pure. */
export function normalizePaging(page?: number, pageSize?: number): { page: number; pageSize: number; skip: number } {
  const p = Math.max(1, Math.floor(page ?? 1));
  const size = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(pageSize ?? DEFAULT_PAGE_SIZE)));
  return { page: p, pageSize: size, skip: (p - 1) * size };
}
