import { politeFetchJson } from '@researchtrics/integration-shared';
import type {
  ScholarlyMetadataProvider,
  ProviderCapability,
  ProviderHealth,
  NormalizedWork,
  NormalizedWorkAuthor,
  PersistentId,
  WorkSearchQuery,
} from './types';
import { timedHealthCheck } from './health';

/**
 * PubMed as a federation metadata provider (addendum §6, §7). A specialized
 * biomedical/health source via NCBI E-utilities (esearch + esummary). Evidence
 * only — never authoritative for all disciplines, and not every record has a
 * DOI (§6). Injectable HTTP for offline tests; endpoints to be re-verified
 * against https://www.ncbi.nlm.nih.gov/books/NBK25501/. NCBI asks for a `tool`
 * + `email`, and an API key for higher rate limits.
 */

export interface PubMedConfig {
  baseUrl?: string | undefined;
  apiKey?: string | undefined;
  tool?: string | undefined;
  email?: string | undefined;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

function ncbiParams(config: PubMedConfig): URLSearchParams {
  const p = new URLSearchParams({ db: 'pubmed', retmode: 'json' });
  if (config.apiKey) p.set('api_key', config.apiKey);
  if (config.tool) p.set('tool', config.tool);
  if (config.email) p.set('email', config.email);
  return p;
}

/** Map one PubMed esummary record into a normalized work. Pure + tested. */
export function mapPubMedSummary(summary: unknown): NormalizedWork {
  const s = summary as any;
  const pmid: string | undefined = typeof s?.uid === 'string' ? s.uid : undefined;

  const articleIds: any[] = Array.isArray(s?.articleids) ? s.articleids : [];
  const doi = articleIds.find((a) => a?.idtype === 'doi')?.value;
  const pmcid = articleIds.find((a) => a?.idtype === 'pmc' || a?.idtype === 'pmcid')?.value;

  const yearMatch = typeof s?.pubdate === 'string' ? s.pubdate.match(/\d{4}/) : null;
  const publishedYear = yearMatch ? Number(yearMatch[0]) : undefined;

  const authors: NormalizedWorkAuthor[] = (Array.isArray(s?.authors) ? s.authors : [])
    .filter((a: any) => a?.authtype === 'Author' || a?.name)
    .map((a: any) => ({ rawName: a?.name ?? 'Unknown' }));

  const work: NormalizedWork = {
    source: 'pubmed',
    resourceType: 'publication',
    title: typeof s?.title === 'string' ? s.title : '(untitled)',
    publishedYear,
    journalTitle: typeof s?.fulljournalname === 'string' ? s.fulljournalname : s?.source,
    externalIds: {
      pmid,
      doi: typeof doi === 'string' ? doi : undefined,
      pmcid: typeof pmcid === 'string' ? pmcid : undefined,
    },
    authors,
    publicationTypes: Array.isArray(s?.pubtype) ? s.pubtype : undefined,
    provenance: {
      source: 'pubmed',
      sourceId: pmid,
      sourceUrl: pmid ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` : undefined,
      retrievedAt: new Date().toISOString(),
    },
    raw: summary,
  };
  return work;
}

export class PubMedMetadataProvider implements ScholarlyMetadataProvider {
  readonly name = 'pubmed';
  readonly external = true;
  readonly capabilities: ProviderCapability[] = ['getWork', 'search', 'healthCheck'];

  constructor(
    private readonly config: PubMedConfig = {},
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private base(): string {
    return (this.config.baseUrl ?? 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils').replace(/\/$/, '');
  }

  private async summariesFor(ids: string[]): Promise<NormalizedWork[]> {
    if (ids.length === 0) return [];
    const p = ncbiParams(this.config);
    p.set('id', ids.join(','));
    const json = (await politeFetchJson(`${this.base()}/esummary.fcgi?${p.toString()}`, {
      fetchImpl: this.fetchImpl,
    })) as any;
    const result = json?.result ?? {};
    const uids: string[] = Array.isArray(result.uids) ? result.uids : ids;
    return uids.map((uid) => mapPubMedSummary(result[uid])).filter((w) => w.externalIds.pmid);
  }

  async getWork(id: PersistentId): Promise<NormalizedWork> {
    if (!id.pmid) throw new Error('PubMedMetadataProvider.getWork requires a PMID');
    const [work] = await this.summariesFor([id.pmid]);
    if (!work) throw new Error(`PubMed record not found: ${id.pmid}`);
    return work;
  }

  async searchWorks(query: WorkSearchQuery): Promise<NormalizedWork[]> {
    if (!query.name) return []; // PubMed author search keys on name (§7)
    const p = ncbiParams(this.config);
    p.set('term', `${query.name}[Author]`);
    p.set('retmax', String(Math.min(query.limit ?? 25, 100)));
    const json = (await politeFetchJson(`${this.base()}/esearch.fcgi?${p.toString()}`, {
      fetchImpl: this.fetchImpl,
    })) as any;
    const ids: string[] = Array.isArray(json?.esearchresult?.idlist) ? json.esearchresult.idlist : [];
    return this.summariesFor(ids);
  }

  healthCheck(): Promise<ProviderHealth> {
    const p = ncbiParams(this.config);
    return timedHealthCheck(this.name, `${this.base()}/einfo.fcgi?${p.toString()}`, this.fetchImpl);
  }
}
