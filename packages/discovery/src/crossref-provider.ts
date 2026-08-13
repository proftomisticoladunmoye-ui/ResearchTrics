import { politeFetchJson } from '@researchtrics/integration-shared';
import type {
  ResearcherDiscoveryProvider,
  DiscoveredResearcher,
  DiscoveredWork,
  DiscoveryQuery,
} from './types';

/**
 * Crossref discovery provider (Discovery Engine §7, §39). Discovers authors
 * from scholarly works via the Crossref REST API polite pool. Crossref is
 * evidence for publication metadata (§37) — never copyrighted full text, never
 * inferred personal data. HTTP is injectable for offline unit tests.
 */

export interface CrossrefDiscoveryConfig {
  baseUrl?: string | undefined;
  mailto?: string | undefined;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

function fullNameOf(a: any): string {
  const given = typeof a?.given === 'string' ? a.given : '';
  const family = typeof a?.family === 'string' ? a.family : '';
  const joined = `${given} ${family}`.trim();
  return joined || (typeof a?.name === 'string' ? a.name : 'Unknown researcher');
}

/**
 * Extract distinct discovered researchers from a Crossref works response.
 * Authors are keyed by ORCID when present, else by normalized name; each
 * accumulates their works, co-authors, and topics. Pure + tested.
 */
export function extractCrossrefAuthors(worksJson: unknown): DiscoveredResearcher[] {
  const items = (worksJson as any)?.message?.items;
  if (!Array.isArray(items)) return [];

  const byKey = new Map<string, DiscoveredResearcher>();

  for (const work of items) {
    const authors: any[] = Array.isArray(work?.author) ? work.author : [];
    const title = Array.isArray(work?.title) ? work.title[0] : work?.title;
    const doi = typeof work?.DOI === 'string' ? work.DOI : undefined;
    const year = work?.issued?.['date-parts']?.[0]?.[0];
    const subjects: string[] = Array.isArray(work?.subject) ? work.subject : [];
    const names = authors.map(fullNameOf);

    for (const a of authors) {
      const orcid =
        typeof a?.ORCID === 'string' ? a.ORCID.replace(/^https?:\/\/orcid\.org\//i, '') : undefined;
      const name = fullNameOf(a);
      const key = orcid ? `orcid:${orcid}` : `name:${name.toLowerCase()}`;

      let cand = byKey.get(key);
      if (!cand) {
        cand = {
          fullName: name,
          nameVariants: [name],
          topics: [],
          works: [],
          coauthors: [],
          provenance: { source: 'crossref', sourceId: doi, sourceUrl: doi ? `https://doi.org/${doi}` : undefined, retrievedAt: new Date().toISOString() },
        };
        if (orcid) cand.orcid = orcid;
        const affiliation = Array.isArray(a?.affiliation) && a.affiliation[0]?.name;
        if (typeof affiliation === 'string') cand.institution = affiliation;
        byKey.set(key, cand);
      }

      const work_: DiscoveredWork = { title: typeof title === 'string' ? title : '(untitled)' };
      if (doi) work_.doi = doi;
      if (typeof year === 'number') work_.year = year;
      cand.works.push(work_);

      for (const co of names) if (co !== name && !cand.coauthors.includes(co)) cand.coauthors.push(co);
      for (const s of subjects) {
        const t = s.trim().toLowerCase();
        if (t && !cand.topics.includes(t)) cand.topics.push(t);
      }
    }
  }

  for (const cand of byKey.values()) {
    cand.publicationCount = cand.works.length;
    cand.topics = cand.topics.slice(0, 10);
  }
  return Array.from(byKey.values());
}

export function buildCrossrefWorksUrl(query: DiscoveryQuery, config: CrossrefDiscoveryConfig): string {
  const base = (config.baseUrl ?? 'https://api.crossref.org').replace(/\/$/, '');
  const params = new URLSearchParams();
  if (query.institution) params.set('query.affiliation', query.institution);
  if (query.topic) params.set('query', query.topic);
  params.set('rows', String(Math.min(query.limit ?? 20, 100)));
  params.set('select', 'DOI,title,author,subject,issued');
  if (config.mailto) params.set('mailto', config.mailto);
  return `${base}/works?${params.toString()}`;
}

export class CrossrefDiscoveryProvider implements ResearcherDiscoveryProvider {
  readonly name = 'crossref';
  readonly external = true;

  constructor(
    private readonly config: CrossrefDiscoveryConfig = {},
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async discover(query: DiscoveryQuery): Promise<DiscoveredResearcher[]> {
    const url = buildCrossrefWorksUrl(query, this.config);
    const json = await politeFetchJson(url, { mailto: this.config.mailto, fetchImpl: this.fetchImpl });
    const authors = extractCrossrefAuthors(json);
    return query.limit != null ? authors.slice(0, query.limit) : authors;
  }
}
