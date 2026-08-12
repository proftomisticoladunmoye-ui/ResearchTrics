import {
  politeFetchJson,
  normalizeDoi,
  stripMarkup,
  type NormalizedPublication,
  type NormalizedAuthor,
} from '@researchtrics/integration-shared';

/**
 * Crossref REST adapter (Spec §14). Highest-priority source for publication
 * metadata (Spec §85). Uses the polite pool via a contact mailto. Endpoints are
 * env-configurable and must be re-verified against Crossref's docs before
 * production (https://api.crossref.org). No API key required.
 */

export interface CrossrefConfig {
  baseUrl: string;
  mailto?: string | undefined;
}

export function loadCrossrefConfig(source: NodeJS.ProcessEnv = process.env): CrossrefConfig {
  return {
    baseUrl: source.CROSSREF_BASE_URL ?? 'https://api.crossref.org',
    mailto: source.CROSSREF_MAILTO,
  };
}

/** Fetch + normalize a work by DOI. Throws NotFoundError when the DOI is unknown. */
export async function fetchByDoi(
  doi: string,
  config: CrossrefConfig = loadCrossrefConfig(),
  fetchImpl: typeof fetch = fetch,
): Promise<NormalizedPublication> {
  const clean = normalizeDoi(doi);
  const url = `${config.baseUrl.replace(/\/$/, '')}/works/${encodeURIComponent(clean)}`;
  const json = await politeFetchJson<{ message: unknown }>(url, {
    mailto: config.mailto,
    fetchImpl,
  });
  return mapCrossref(json.message);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Map a Crossref `message` object into the normalized shape. Pure + tested. */
export function mapCrossref(message: unknown): NormalizedPublication {
  const m = message as Record<string, any>;
  const title = firstString(m?.title) ?? '(untitled)';
  const journalTitle = firstString(m?.['container-title']);
  const issns: string[] = Array.isArray(m?.ISSN) ? m.ISSN : [];
  const dateParts: number[] | undefined =
    m?.published?.['date-parts']?.[0] ??
    m?.['published-print']?.['date-parts']?.[0] ??
    m?.['published-online']?.['date-parts']?.[0] ??
    m?.issued?.['date-parts']?.[0];

  const pub: NormalizedPublication = {
    source: 'crossref',
    title,
    authors: mapAuthors(m?.author),
    raw: message,
  };

  if (typeof m?.DOI === 'string') pub.doi = m.DOI.toLowerCase();
  if (journalTitle) pub.journalTitle = journalTitle;
  if (issns[0]) pub.issnPrint = issns[0];
  if (issns[1]) pub.issnElectronic = issns[1];
  if (typeof m?.volume === 'string') pub.volume = m.volume;
  if (typeof m?.issue === 'string') pub.issue = m.issue;
  if (typeof m?.publisher === 'string') pub.publisher = m.publisher;
  if (typeof m?.type === 'string') pub.outputType = mapType(m.type);
  if (typeof m?.abstract === 'string') pub.abstract = stripMarkup(m.abstract);
  if (typeof m?.['is-referenced-by-count'] === 'number')
    pub.citationCount = m['is-referenced-by-count'];

  const pages = typeof m?.page === 'string' ? m.page.split('-') : [];
  if (pages[0]) pub.firstPage = pages[0].trim();
  if (pages[1]) pub.lastPage = pages[1].trim();

  if (Array.isArray(dateParts) && typeof dateParts[0] === 'number') {
    pub.publishedYear = dateParts[0];
    const y = dateParts[0];
    const mo = dateParts[1] ?? 1;
    const d = dateParts[2] ?? 1;
    pub.publishedOn = new Date(Date.UTC(y, mo - 1, d)).toISOString();
  }

  const licenseUrl = Array.isArray(m?.license) ? m.license[0]?.URL : undefined;
  const licenseCode = licenseUrl ? mapLicense(licenseUrl) : undefined;
  if (licenseCode) pub.licenseCode = licenseCode;

  const pdf = Array.isArray(m?.link)
    ? m.link.find((l: any) => l?.['content-type'] === 'application/pdf')?.URL
    : undefined;
  if (typeof pdf === 'string') pub.pdfUrl = pdf;

  return pub;
}

function mapAuthors(authors: unknown): NormalizedAuthor[] {
  if (!Array.isArray(authors)) return [];
  return authors.map((a: any, i: number): NormalizedAuthor => {
    const given = typeof a?.given === 'string' ? a.given : undefined;
    const family = typeof a?.family === 'string' ? a.family : undefined;
    const rawName = [given, family].filter(Boolean).join(' ') || a?.name || 'Unknown';
    const orcid =
      typeof a?.ORCID === 'string' ? a.ORCID.replace(/^https?:\/\/orcid\.org\//i, '') : undefined;
    const affiliation = Array.isArray(a?.affiliation) ? a.affiliation[0]?.name : undefined;
    const author: NormalizedAuthor = { rawName, sequence: i };
    if (given) author.givenName = given;
    if (family) author.familyName = family;
    if (orcid) author.orcid = orcid;
    if (typeof affiliation === 'string') author.affiliation = affiliation;
    if (a?.sequence === 'first') author.isCorresponding = false;
    return author;
  });
}

function firstString(v: unknown): string | undefined {
  if (Array.isArray(v) && typeof v[0] === 'string') return v[0];
  if (typeof v === 'string') return v;
  return undefined;
}

function mapType(type: string): string {
  const map: Record<string, string> = {
    'journal-article': 'journal_article',
    'proceedings-article': 'conference_paper',
    'book-chapter': 'book_chapter',
    book: 'book',
    'posted-content': 'preprint',
    dataset: 'dataset',
    report: 'technical_report',
    dissertation: 'dissertation',
  };
  return map[type] ?? 'other';
}

function mapLicense(url: string): string | undefined {
  const u = url.toLowerCase();
  if (u.includes('creativecommons.org/licenses/by-nc-nd')) return 'CC-BY-NC-ND';
  if (u.includes('creativecommons.org/licenses/by-nc-sa')) return 'CC-BY-NC-SA';
  if (u.includes('creativecommons.org/licenses/by-nc')) return 'CC-BY-NC';
  if (u.includes('creativecommons.org/licenses/by-sa')) return 'CC-BY-SA';
  if (u.includes('creativecommons.org/licenses/by-nd')) return 'CC-BY-ND';
  if (u.includes('creativecommons.org/licenses/by')) return 'CC-BY';
  return undefined;
}
/* eslint-enable @typescript-eslint/no-explicit-any */
