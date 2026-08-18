import {
  prisma,
  type PrismaClient,
  type CitationSource,
  type ExternalSource,
} from '@researchtrics/db';
import {
  createPublicationFromNormalized,
  linkResearcherToPublication,
  type CreatePublicationInput,
  type NormalizedAuthorInput,
} from './publication';
import { runDiscovery, type RunDiscoveryInput, type DiscoveryRunSummary } from './discovery';
import { logger } from './logger';

/**
 * OpenAlex works ingestion (federation-first, §5, §25). Given a discovered
 * researcher's OpenAlex author id, pull their works and materialize them as
 * publications — deduped on DOI, provenance-tagged, and linked back to the
 * researcher so their profile shows real papers + citations. This is what turns
 * a discovered *name* into a discovered *body of work*.
 */

// ---------- Pure mappers (testable, no I/O) ----------

/** Rebuild an abstract from OpenAlex's inverted index ({word: [positions]}). */
export function reconstructAbstract(inverted: unknown): string | undefined {
  if (!inverted || typeof inverted !== 'object') return undefined;
  const slots: string[] = [];
  for (const [word, positions] of Object.entries(inverted as Record<string, number[]>)) {
    if (!Array.isArray(positions)) continue;
    for (const p of positions) if (typeof p === 'number') slots[p] = word;
  }
  const text = slots.filter(Boolean).join(' ').trim();
  return text.length > 0 ? text.slice(0, 5000) : undefined;
}

const TYPE_MAP: Record<string, string> = {
  article: 'journal_article',
  book: 'book',
  'book-chapter': 'book_chapter',
  dissertation: 'dissertation',
  thesis: 'thesis',
  preprint: 'preprint',
  dataset: 'dataset',
  report: 'technical_report',
  'proceedings-article': 'conference_paper',
  paratext: 'other',
};

function mapOutputType(t: unknown): string {
  return typeof t === 'string' && TYPE_MAP[t] ? TYPE_MAP[t] : 'journal_article';
}

function stripPrefix(v: unknown, re: RegExp): string | undefined {
  return typeof v === 'string' ? v.replace(re, '') : undefined;
}

/** Map one OpenAlex work → a publication-create input, or null if unusable. */
export function mapOpenAlexWork(work: unknown): CreatePublicationInput | null {
  // External OpenAlex response — an untyped, deeply-nested third-party shape.
  // `any` is intentional here; every field access below is defensively guarded.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = work as Record<string, any>;
  const title = (typeof w?.title === 'string' ? w.title : w?.display_name)?.trim();
  if (!title) return null;

  const openAlexId = stripPrefix(w?.id, /^https?:\/\/openalex\.org\//i);
  const doi = stripPrefix(w?.doi, /^https?:\/\/(dx\.)?doi\.org\//i)?.toLowerCase();
  const source = w?.primary_location?.source ?? w?.locations?.[0]?.source;

  const authors: NormalizedAuthorInput[] = Array.isArray(w?.authorships)
    ? w.authorships
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((au: any): NormalizedAuthorInput | null => {
          const rawName = typeof au?.author?.display_name === 'string' ? au.author.display_name : null;
          if (!rawName) return null;
          return {
            rawName,
            orcid: stripPrefix(au?.author?.orcid, /^https?:\/\/orcid\.org\//i),
            affiliation:
              typeof au?.institutions?.[0]?.display_name === 'string'
                ? au.institutions[0].display_name
                : undefined,
          };
        })
        .filter((a: NormalizedAuthorInput | null): a is NormalizedAuthorInput => a !== null)
        .slice(0, 100)
    : [];

  return {
    title: title.slice(0, 500),
    doi,
    outputType: mapOutputType(w?.type),
    journalTitle: typeof source?.display_name === 'string' ? source.display_name : undefined,
    issnElectronic: typeof source?.issn_l === 'string' ? source.issn_l : undefined,
    publishedYear: typeof w?.publication_year === 'number' ? w.publication_year : undefined,
    publishedOn: typeof w?.publication_date === 'string' ? w.publication_date : undefined,
    publisher: typeof source?.host_organization_name === 'string' ? source.host_organization_name : undefined,
    openAlexId,
    abstract: reconstructAbstract(w?.abstract_inverted_index),
    openAccess: w?.open_access?.is_oa === true,
    pdfUrl:
      (typeof w?.primary_location?.pdf_url === 'string' ? w.primary_location.pdf_url : undefined) ??
      (typeof w?.open_access?.oa_url === 'string' ? w.open_access.oa_url : undefined),
    authors,
    citationCounts:
      typeof w?.cited_by_count === 'number'
        ? [{ source: 'openalex' as CitationSource, count: w.cited_by_count }]
        : undefined,
    provenance: openAlexId
      ? [{ source: 'openalex' as ExternalSource, sourceId: openAlexId, sourceUrl: w?.id }]
      : undefined,
  };
}

// ---------- Fetch + ingest ----------

export interface OpenAlexWorksOptions {
  mailto?: string;
  limit?: number;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

/** Fetch an author's works from OpenAlex (most-cited first). */
export async function fetchOpenAlexWorksForAuthor(
  openalexAuthorId: string,
  opts: OpenAlexWorksOptions = {},
): Promise<unknown[]> {
  const base = (opts.baseUrl ?? 'https://api.openalex.org').replace(/\/$/, '');
  const params = new URLSearchParams({
    filter: `author.id:${openalexAuthorId}`,
    'per-page': String(Math.min(opts.limit ?? 25, 200)),
    sort: 'cited_by_count:desc',
  });
  if (opts.mailto) params.set('mailto', opts.mailto);
  const res = await (opts.fetchImpl ?? fetch)(`${base}/works?${params.toString()}`);
  if (!res.ok) throw new Error(`OpenAlex works failed: ${res.status}`);
  const json = (await res.json()) as { results?: unknown[] };
  return json.results ?? [];
}

export interface ResearcherWorksResult {
  fetched: number;
  created: number;
  exists: number;
}

/** Fetch + ingest a researcher's OpenAlex works, linking each back to them. */
export async function ingestResearcherWorks(
  researcher: { id: string; displayName: string; openalexAuthorId: string; orcid?: string | undefined },
  opts: OpenAlexWorksOptions = {},
  client: PrismaClient = prisma,
): Promise<ResearcherWorksResult> {
  const works = await fetchOpenAlexWorksForAuthor(researcher.openalexAuthorId, opts);
  let created = 0;
  let exists = 0;
  for (const w of works) {
    const input = mapOpenAlexWork(w);
    if (!input) continue;
    const res = await createPublicationFromNormalized(input, client);
    if (res.status === 'created') created += 1;
    else exists += 1;
    await linkResearcherToPublication(res.publicationId, researcher, client);
  }
  return { fetched: works.length, created, exists };
}

// ---------- Orchestration: discover researchers, then enrich with works ----------

export interface DiscoveryWithWorksSummary extends DiscoveryRunSummary {
  researchersEnriched: number;
  worksCreated: number;
}

/**
 * Run a discovery batch, then enrich each newly-created researcher with their
 * OpenAlex works — the full federation-first population step. Bounded by the
 * query limit and `worksPerResearcher`.
 */
export async function runDiscoveryWithWorks(
  input: RunDiscoveryInput,
  opts: { worksPerResearcher?: number; mailto?: string } = {},
  client: PrismaClient = prisma,
): Promise<DiscoveryWithWorksSummary> {
  const summary = await runDiscovery(input, client);
  let researchersEnriched = 0;
  let worksCreated = 0;

  for (const c of summary.candidates) {
    const r = await client.researcher.findUnique({
      where: { slug: c.slug },
      include: { identifiers: true },
    });
    if (!r) continue;
    const openalexAuthorId = r.identifiers.find((i) => i.scheme === 'openalex')?.value;
    if (!openalexAuthorId) continue;
    const orcid = r.identifiers.find((i) => i.scheme === 'orcid')?.value;
    try {
      const res = await ingestResearcherWorks(
        { id: r.id, displayName: r.displayName, openalexAuthorId, orcid },
        { mailto: opts.mailto, limit: opts.worksPerResearcher ?? 25 },
        client,
      );
      worksCreated += res.created;
      researchersEnriched += 1;
    } catch (err) {
      logger.warn({ err, slug: c.slug }, 'Works ingestion failed for researcher');
    }
  }

  logger.info({ ...summary, researchersEnriched, worksCreated }, 'Discovery-with-works complete');
  return { ...summary, researchersEnriched, worksCreated };
}
