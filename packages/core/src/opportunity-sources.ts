import type { OpportunityType } from '@researchtrics/db';

/**
 * Opportunity ingestion providers (Spec §20, §85).
 *
 * A provider abstraction — mirroring the discovery and federation engines — for
 * pulling forward-looking opportunities (grants, fellowships, calls) from
 * legitimate sources with open APIs. Every ingested listing keeps its
 * provenance (`source` + `sourceUrl`); nothing is scraped or fabricated, and a
 * provider only ever touches records it created (never manual listings).
 *
 * Providers take an injectable `fetchImpl` so ingestion is fully offline-testable
 * with a stub, and each real source stays config-gated until its terms are
 * reviewed.
 */

/**
 * Infer the opportunity type from its title, so funding feeds (which return
 * everything as "grant") still surface fellowships, awards, positions, training,
 * and conferences. Falls back to `fallback` when nothing matches.
 */
export function classifyOpportunityType(title: string, fallback: OpportunityType = 'grant'): OpportunityType {
  const t = title.toLowerCase();
  if (/\bcall for papers\b|\bcfp\b/.test(t)) return 'call_for_papers';
  if (/\bconferenc|\bsymposium|\bcongress|\bworkshop\b/.test(t)) return 'conference';
  if (/\bfellowship|\bfellow\b/.test(t)) return 'fellowship';
  if (/\bpost-?doc|postdoctoral|\bvacanc|\blecturer|\bprofessor|\bfaculty position|\bposition\b|\brecruit/.test(t))
    return 'position';
  if (/\baward\b|\bprize\b|\bmedal\b/.test(t)) return 'award';
  if (/\btraining\b|summer school|\bcourse\b|\bbootcamp|\bschool\b/.test(t)) return 'training';
  return fallback;
}

export interface NormalizedOpportunity {
  /** Stable id from the source (for logging/traceability). */
  readonly externalId: string;
  readonly title: string;
  readonly type: OpportunityType;
  readonly summary?: string;
  readonly organization?: string;
  readonly country?: string;
  /** Canonical link to read/apply. */
  readonly url?: string;
  /** The source record URL — the dedupe key for idempotent ingestion. */
  readonly sourceUrl?: string;
  readonly opensAt?: Date;
  readonly deadline?: Date;
}

export interface OpportunityQuery {
  /** Free-text keyword to filter the source (optional). */
  readonly keyword?: string;
  /** Max listings to pull this run. */
  readonly rows?: number;
}

export interface OpportunityProvider {
  /** Short provenance slug, e.g. `grants_gov`. Stored as `import:<name>`. */
  readonly name: string;
  fetchOpportunities(query: OpportunityQuery): Promise<NormalizedOpportunity[]>;
}

// ---------- Fixture provider (offline) ----------

/** Deterministic sample data — used for offline smoke and as a safe default. */
export class FixtureOpportunityProvider implements OpportunityProvider {
  readonly name = 'fixture';
  constructor(private readonly items: NormalizedOpportunity[] = FIXTURE_OPPORTUNITIES) {}
  async fetchOpportunities(query: OpportunityQuery): Promise<NormalizedOpportunity[]> {
    const rows = query.rows ?? this.items.length;
    return this.items.slice(0, rows);
  }
}

const FIXTURE_OPPORTUNITIES: NormalizedOpportunity[] = [
  {
    externalId: 'FIX-0001',
    title: 'Open Science Infrastructure Grant',
    type: 'grant',
    summary: 'Support for open, reproducible research infrastructure.',
    organization: 'Example Foundation',
    country: 'US',
    url: 'https://example.org/opps/FIX-0001',
    sourceUrl: 'https://example.org/opps/FIX-0001',
    deadline: new Date(Date.now() + 60 * 24 * 3600_000),
  },
];

// ---------- Grants.gov (US federal funding opportunities) ----------

export interface GrantsGovConfig {
  /** Defaults to the public Search2 API base. */
  baseUrl?: string;
  /** Injectable fetch for tests / custom agents. */
  fetchImpl?: typeof fetch;
}

/** One `oppHits` record from the Grants.gov Search2 API. */
interface GrantsGovHit {
  id?: string | number;
  number?: string;
  title?: string;
  agencyName?: string;
  agency?: string;
  agencyCode?: string;
  openDate?: string; // MM/DD/YYYY
  closeDate?: string; // MM/DD/YYYY
}

/** Parse a Grants.gov MM/DD/YYYY date, or undefined. */
function parseUsDate(s?: string): Date | undefined {
  if (!s) return undefined;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return undefined;
  const d = new Date(Date.UTC(Number(m[3]), Number(m[1]) - 1, Number(m[2])));
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** Pure mapper: a Grants.gov hit → a NormalizedOpportunity (no I/O). */
export function mapGrantsGov(hit: GrantsGovHit): NormalizedOpportunity | null {
  const title = hit.title?.trim();
  const id = hit.id != null ? String(hit.id) : hit.number;
  if (!title || !id) return null;
  const url = `https://www.grants.gov/search-results-detail/${id}`;
  return {
    externalId: id,
    title,
    type: classifyOpportunityType(title, 'grant'),
    organization: (hit.agencyName ?? hit.agency)?.trim() || undefined,
    country: 'US',
    url,
    sourceUrl: url,
    opensAt: parseUsDate(hit.openDate),
    deadline: parseUsDate(hit.closeDate),
  };
}

export class GrantsGovProvider implements OpportunityProvider {
  readonly name = 'grants_gov';
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: GrantsGovConfig = {}) {
    this.baseUrl = (config.baseUrl ?? 'https://api.grants.gov/v1/api').replace(/\/$/, '');
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  async fetchOpportunities(query: OpportunityQuery): Promise<NormalizedOpportunity[]> {
    const res = await this.fetchImpl(`${this.baseUrl}/search2`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        keyword: query.keyword ?? '',
        oppStatuses: 'posted',
        rows: query.rows ?? 50,
      }),
    });
    if (!res.ok) throw new Error(`Grants.gov search failed: ${res.status}`);
    const json = (await res.json()) as { data?: { oppHits?: GrantsGovHit[] } };
    const hits = json.data?.oppHits ?? [];
    return hits.map(mapGrantsGov).filter((o): o is NormalizedOpportunity => o !== null);
  }
}

// ---------- EU Funding & Tenders Portal (SEDIA search API) ----------

export interface EuFundingConfig {
  /** Defaults to the public SEDIA search API. */
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

/**
 * SEDIA status codes for a call's lifecycle. We skip closed calls at map time;
 * forthcoming/open are ingested and later auto-closed by the deadline sweep.
 */
const EU_STATUS = { forthcoming: '31094501', open: '31094502', closed: '31094503' } as const;

/** One SEDIA search result. Metadata values are arrays of strings. */
interface EuFundingResult {
  reference?: string;
  url?: string;
  title?: string;
  metadata?: {
    identifier?: string[];
    title?: string[];
    status?: string[];
    deadlineDate?: string[];
    startDate?: string[];
  };
}

/** Pure mapper: a SEDIA result → NormalizedOpportunity (skips closed/invalid). */
export function mapEuFunding(result: EuFundingResult): NormalizedOpportunity | null {
  const md = result.metadata ?? {};
  const title = (md.title?.[0] ?? result.title)?.trim();
  const id = md.identifier?.[0] ?? result.reference;
  if (!title || !id) return null;
  if (md.status?.[0] === EU_STATUS.closed) return null;

  const deadlineRaw = md.deadlineDate?.[0];
  const deadline = deadlineRaw ? new Date(deadlineRaw) : undefined;
  const startRaw = md.startDate?.[0];
  const opensAt = startRaw ? new Date(startRaw) : undefined;

  return {
    externalId: id,
    title,
    type: classifyOpportunityType(title, 'grant'),
    organization: 'European Commission',
    country: 'EU',
    url: result.url,
    sourceUrl: result.url,
    opensAt: opensAt && !Number.isNaN(opensAt.getTime()) ? opensAt : undefined,
    deadline: deadline && !Number.isNaN(deadline.getTime()) ? deadline : undefined,
  };
}

export class EuFundingProvider implements OpportunityProvider {
  readonly name = 'eu_funding';
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: EuFundingConfig = {}) {
    this.baseUrl = (config.baseUrl ?? 'https://api.tech.ec.europa.eu/search-api/prod/rest/search').replace(
      /\/$/,
      '',
    );
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  async fetchOpportunities(query: OpportunityQuery): Promise<NormalizedOpportunity[]> {
    const url = `${this.baseUrl}?apiKey=SEDIA&text=${encodeURIComponent(query.keyword ?? '***')}&pageSize=${query.rows ?? 50}&pageNumber=1`;
    const res = await this.fetchImpl(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      // Grants database, forthcoming + open calls.
      body: JSON.stringify({
        query: {
          bool: {
            must: [{ terms: { status: [EU_STATUS.forthcoming, EU_STATUS.open] } }],
          },
        },
      }),
    });
    if (!res.ok) throw new Error(`EU Funding search failed: ${res.status}`);
    const json = (await res.json()) as { results?: EuFundingResult[] };
    return (json.results ?? [])
      .map(mapEuFunding)
      .filter((o): o is NormalizedOpportunity => o !== null);
  }
}

// ---------- WikiCFP (conference calls-for-papers, via RSS) ----------

export interface WikiCfpConfig {
  /** RSS base; a category is appended. Defaults to the public feed. */
  baseUrl?: string;
  /** Category, e.g. "computer science". */
  category?: string;
  fetchImpl?: typeof fetch;
}

const HTML_ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'" };
function decodeEntities(s: string): string {
  return s.replace(/&amp;|&lt;|&gt;|&quot;|&#39;|&apos;/g, (m) => HTML_ENTITIES[m] ?? m).trim();
}

/** Extract <item> field values from an RSS string (small, dependency-free). */
function rssItems(xml: string): Array<Record<string, string>> {
  const items: Array<Record<string, string>> = [];
  for (const block of xml.split(/<item[\s>]/i).slice(1)) {
    const body = block.split(/<\/item>/i)[0] ?? '';
    const field = (tag: string) => {
      const m = body.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
      return m ? decodeEntities(m[1]!.replace(/<!\[CDATA\[|\]\]>/g, '')) : '';
    };
    items.push({ title: field('title'), link: field('link'), description: field('description'), guid: field('guid') });
  }
  return items;
}

/** Pure mapper: a WikiCFP RSS item → NormalizedOpportunity (skips invalid). */
export function mapWikiCfpItem(item: Record<string, string>): NormalizedOpportunity | null {
  const title = item.title?.trim();
  if (!title || !item.link) return null;
  // Description ends with "[Location] [Start - End]" brackets.
  const brackets = [...(item.description ?? '').matchAll(/\[([^\]]+)\]/g)].map((m) => m[1]!.trim());
  const location = brackets.length >= 2 ? brackets[brackets.length - 2] : undefined;
  const dateRange = brackets.length >= 1 ? brackets[brackets.length - 1] : undefined;
  const country = location && location !== 'Virtual' ? location.split(',').pop()?.trim() : undefined;
  const endDate = dateRange?.split(/[-–]/).pop()?.trim();
  const deadline = endDate ? new Date(endDate) : undefined;

  return {
    externalId: item.guid || item.link,
    title,
    type: 'call_for_papers',
    organization: 'WikiCFP',
    country,
    url: item.link,
    sourceUrl: item.link,
    deadline: deadline && !Number.isNaN(deadline.getTime()) ? deadline : undefined,
  };
}

export class WikiCfpProvider implements OpportunityProvider {
  readonly name = 'wikicfp';
  private readonly baseUrl: string;
  private readonly category: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: WikiCfpConfig = {}) {
    this.baseUrl = (config.baseUrl ?? 'https://www.wikicfp.com/cfp/rss').replace(/\/$/, '');
    this.category = config.category ?? 'research';
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  async fetchOpportunities(query: OpportunityQuery): Promise<NormalizedOpportunity[]> {
    const cat = encodeURIComponent(query.keyword ?? this.category);
    const res = await this.fetchImpl(`${this.baseUrl}?cat=${cat}`, {
      headers: { 'user-agent': 'ResearchTrics/1.0 (+https://www.researchtrics.com)' },
    });
    if (!res.ok) throw new Error(`WikiCFP fetch failed: ${res.status}`);
    const xml = await res.text();
    return rssItems(xml)
      .map(mapWikiCfpItem)
      .filter((o): o is NormalizedOpportunity => o !== null)
      .slice(0, query.rows ?? 50);
  }
}

// ---------- Factory ----------

export type OpportunitySourceName = 'fixture' | 'grants_gov' | 'eu_funding' | 'wikicfp';

export function createOpportunityProvider(
  name: OpportunitySourceName,
  config: { grantsGov?: GrantsGovConfig; euFunding?: EuFundingConfig; wikicfp?: WikiCfpConfig } = {},
): OpportunityProvider {
  switch (name) {
    case 'grants_gov':
      return new GrantsGovProvider(config.grantsGov);
    case 'eu_funding':
      return new EuFundingProvider(config.euFunding);
    case 'wikicfp':
      return new WikiCfpProvider(config.wikicfp);
    case 'fixture':
    default:
      return new FixtureOpportunityProvider();
  }
}
