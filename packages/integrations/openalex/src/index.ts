import {
  politeFetchJson,
  normalizeDoi,
  type NormalizedPublication,
  type NormalizedAuthor,
} from '@researchtrics/integration-shared';

/**
 * OpenAlex adapter (Spec §15). Discovery + enrichment (citations, related
 * works) — NEVER authoritative for identity. Endpoints env-configurable and to
 * be re-verified against OpenAlex docs (https://api.openalex.org). Optional
 * mailto joins the polite pool.
 */

export interface OpenAlexConfig {
  baseUrl: string;
  mailto?: string | undefined;
  apiKey?: string | undefined;
}

export function loadOpenAlexConfig(source: NodeJS.ProcessEnv = process.env): OpenAlexConfig {
  return {
    baseUrl: source.OPENALEX_BASE_URL ?? 'https://api.openalex.org',
    mailto: source.OPENALEX_MAILTO,
    apiKey: source.OPENALEX_API_KEY,
  };
}

/** Fetch + normalize an OpenAlex work by DOI. */
export async function fetchByDoi(
  doi: string,
  config: OpenAlexConfig = loadOpenAlexConfig(),
  fetchImpl: typeof fetch = fetch,
): Promise<NormalizedPublication> {
  const clean = normalizeDoi(doi);
  const params = new URLSearchParams();
  if (config.mailto) params.set('mailto', config.mailto);
  if (config.apiKey) params.set('api_key', config.apiKey);
  const qs = params.toString();
  const url = `${config.baseUrl.replace(/\/$/, '')}/works/doi:${encodeURIComponent(clean)}${qs ? `?${qs}` : ''}`;
  const json = await politeFetchJson(url, { mailto: config.mailto, fetchImpl });
  return mapOpenAlex(json);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Map an OpenAlex work object into the normalized shape. Pure + tested. */
export function mapOpenAlex(work: unknown): NormalizedPublication {
  const w = work as Record<string, any>;
  const pub: NormalizedPublication = {
    source: 'openalex',
    title: typeof w?.display_name === 'string' ? w.display_name : (w?.title ?? '(untitled)'),
    authors: mapAuthorships(w?.authorships),
    raw: work,
  };

  if (typeof w?.id === 'string') pub.openAlexId = w.id.replace(/^https?:\/\/openalex\.org\//i, '');
  if (typeof w?.doi === 'string') pub.doi = normalizeDoi(w.doi);
  if (typeof w?.cited_by_count === 'number') pub.citationCount = w.cited_by_count;
  if (typeof w?.publication_year === 'number') pub.publishedYear = w.publication_year;
  if (typeof w?.publication_date === 'string') pub.publishedOn = w.publication_date;
  if (typeof w?.type === 'string') pub.outputType = mapType(w.type);

  const source = w?.primary_location?.source ?? w?.host_venue;
  if (typeof source?.display_name === 'string') pub.journalTitle = source.display_name;
  if (typeof source?.issn_l === 'string') pub.issnPrint = source.issn_l;

  const biblio = w?.biblio ?? {};
  if (typeof biblio.volume === 'string') pub.volume = biblio.volume;
  if (typeof biblio.issue === 'string') pub.issue = biblio.issue;
  if (typeof biblio.first_page === 'string') pub.firstPage = biblio.first_page;
  if (typeof biblio.last_page === 'string') pub.lastPage = biblio.last_page;

  const pdfUrl = w?.primary_location?.pdf_url ?? w?.open_access?.oa_url;
  if (typeof pdfUrl === 'string') pub.pdfUrl = pdfUrl;

  const abstract = reconstructAbstract(w?.abstract_inverted_index);
  if (abstract) pub.abstract = abstract;

  return pub;
}

function mapAuthorships(authorships: unknown): NormalizedAuthor[] {
  if (!Array.isArray(authorships)) return [];
  return authorships.map((a: any, i: number): NormalizedAuthor => {
    const name = a?.author?.display_name ?? a?.raw_author_name ?? 'Unknown';
    const orcid =
      typeof a?.author?.orcid === 'string'
        ? a.author.orcid.replace(/^https?:\/\/orcid\.org\//i, '')
        : undefined;
    const affiliation = Array.isArray(a?.institutions) ? a.institutions[0]?.display_name : undefined;
    const author: NormalizedAuthor = { rawName: name, sequence: i };
    if (orcid) author.orcid = orcid;
    if (typeof affiliation === 'string') author.affiliation = affiliation;
    if (a?.author_position === 'first') author.isCorresponding = false;
    return author;
  });
}

/** Reconstruct plain-text abstract from OpenAlex's inverted index. Pure. */
export function reconstructAbstract(inverted: unknown): string | undefined {
  if (!inverted || typeof inverted !== 'object') return undefined;
  const entries = Object.entries(inverted as Record<string, number[]>);
  if (entries.length === 0) return undefined;
  const positions: string[] = [];
  for (const [word, idxs] of entries) {
    for (const idx of idxs) positions[idx] = word;
  }
  const text = positions.filter((w) => w !== undefined).join(' ').trim();
  return text || undefined;
}

function mapType(type: string): string {
  const map: Record<string, string> = {
    article: 'journal_article',
    'proceedings-article': 'conference_paper',
    'book-chapter': 'book_chapter',
    book: 'book',
    dataset: 'dataset',
    dissertation: 'dissertation',
    preprint: 'preprint',
    report: 'technical_report',
  };
  return map[type] ?? 'other';
}
/* eslint-enable @typescript-eslint/no-explicit-any */
