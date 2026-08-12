import { SEARCHABLE_TYPES, type SearchQuery, type SearchableType, type SearchFilters } from './types';

type ParamSource = URLSearchParams | Record<string, string | undefined>;

function get(src: ParamSource, key: string): string | undefined {
  if (src instanceof URLSearchParams) return src.get(key) ?? undefined;
  return src[key];
}

function toInt(v: string | undefined): number | undefined {
  if (v === undefined) return undefined;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : undefined;
}

/** Parse request params into a validated SearchQuery. Pure and tested. */
export function parseSearchParams(src: ParamSource): SearchQuery {
  const q = (get(src, 'q') ?? '').trim();

  const typeParam = get(src, 'type');
  const types = typeParam
    ? typeParam
        .split(',')
        .map((t) => t.trim())
        .filter((t): t is SearchableType => (SEARCHABLE_TYPES as readonly string[]).includes(t))
    : undefined;

  const filters: SearchFilters = {};
  if (types && types.length > 0) filters.types = types;
  const country = get(src, 'country')?.trim();
  if (country) filters.country = country;
  const yearFrom = toInt(get(src, 'yearFrom'));
  if (yearFrom !== undefined) filters.yearFrom = yearFrom;
  const yearTo = toInt(get(src, 'yearTo'));
  if (yearTo !== undefined) filters.yearTo = yearTo;
  if (get(src, 'openAccess') === 'true') filters.openAccess = true;
  if (get(src, 'verified') === 'true') filters.verifiedOnly = true;

  const query: SearchQuery = { q };
  if (Object.keys(filters).length > 0) query.filters = filters;
  const page = toInt(get(src, 'page'));
  if (page !== undefined) query.page = page;
  const pageSize = toInt(get(src, 'pageSize'));
  if (pageSize !== undefined) query.pageSize = pageSize;
  return query;
}
