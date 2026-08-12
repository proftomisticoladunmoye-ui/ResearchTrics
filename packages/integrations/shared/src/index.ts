/**
 * Shared integration primitives (Spec §14, §84, §85). Adapters expose a
 * domain-shaped normalized publication; raw provider JSON never leaks past the
 * adapter boundary.
 */

export type NormalizedSource = 'crossref' | 'openalex' | 'ojs';

export interface NormalizedAuthor {
  rawName: string;
  givenName?: string;
  familyName?: string;
  orcid?: string;
  affiliation?: string;
  sequence?: number;
  isCorresponding?: boolean;
}

export interface NormalizedPublication {
  source: NormalizedSource;
  title: string;
  abstract?: string;
  doi?: string;
  outputType?: string;
  journalTitle?: string;
  issnPrint?: string;
  issnElectronic?: string;
  volume?: string;
  issue?: string;
  firstPage?: string;
  lastPage?: string;
  publishedYear?: number;
  publishedOn?: string; // ISO date
  publisher?: string;
  licenseCode?: string;
  pdfUrl?: string;
  openAlexId?: string;
  citationCount?: number;
  authors: NormalizedAuthor[];
  raw: unknown;
}

/** Normalize a DOI: strip URL prefixes, lowercase, trim. Does not validate. */
export function normalizeDoi(input: string): string {
  return input
    .trim()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')
    .replace(/^doi:/i, '')
    .toLowerCase();
}

export interface PoliteFetchOptions {
  /** Contact email for the provider's polite pool (Spec §14). */
  mailto?: string | undefined;
  /** Product token for the User-Agent. */
  product?: string;
  headers?: Record<string, string>;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

/**
 * Fetch JSON with a polite, identifiable User-Agent and timeout. Adapters use
 * this so every outbound scholarly request is contactable and rate-friendly.
 */
export async function politeFetchJson<T = unknown>(
  url: string,
  options: PoliteFetchOptions = {},
): Promise<T> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const product = options.product ?? 'ResearchTrics';
  const ua = options.mailto
    ? `${product}/1.0 (+https://researchtrics.local; mailto:${options.mailto})`
    : `${product}/1.0 (+https://researchtrics.local)`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 15000);
  try {
    const res = await fetchImpl(url, {
      headers: { accept: 'application/json', 'user-agent': ua, ...(options.headers ?? {}) },
      signal: controller.signal,
    });
    if (res.status === 404) {
      throw new NotFoundError(url);
    }
    if (!res.ok) {
      throw new Error(`Request failed (${res.status}) for ${url}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export class NotFoundError extends Error {
  constructor(url: string) {
    super(`Resource not found: ${url}`);
    this.name = 'NotFoundError';
  }
}

/** Strip JATS/HTML tags from an abstract, collapsing whitespace. */
export function stripMarkup(input: string): string {
  return input
    .replace(/<[^>]+>/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}
