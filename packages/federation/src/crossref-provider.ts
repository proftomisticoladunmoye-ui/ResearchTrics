import { fetchByDoi, type CrossrefConfig } from '@researchtrics/integration-crossref';
import type {
  ScholarlyMetadataProvider,
  ProviderCapability,
  ProviderHealth,
  NormalizedWork,
  PersistentId,
} from './types';
import { toNormalizedWork } from './normalize';
import { timedHealthCheck } from './health';

/**
 * Crossref as a federation metadata provider (addendum §3). Wraps the existing
 * Crossref adapter; evidence for DOI publication metadata (§37). Polite pool +
 * injectable HTTP for offline tests.
 */
export class CrossrefMetadataProvider implements ScholarlyMetadataProvider {
  readonly name = 'crossref';
  readonly external = true;
  readonly capabilities: ProviderCapability[] = ['getWork', 'healthCheck'];

  constructor(
    private readonly config: CrossrefConfig = { baseUrl: 'https://api.crossref.org' },
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async getWork(id: PersistentId): Promise<NormalizedWork> {
    if (!id.doi) throw new Error('CrossrefMetadataProvider.getWork requires a DOI');
    const pub = await fetchByDoi(id.doi, this.config, this.fetchImpl);
    return toNormalizedWork(pub, this.name);
  }

  healthCheck(): Promise<ProviderHealth> {
    const base = (this.config.baseUrl ?? 'https://api.crossref.org').replace(/\/$/, '');
    const params = new URLSearchParams({ rows: '0' });
    if (this.config.mailto) params.set('mailto', this.config.mailto);
    return timedHealthCheck(this.name, `${base}/works?${params.toString()}`, this.fetchImpl);
  }
}
