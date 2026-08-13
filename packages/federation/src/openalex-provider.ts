import { fetchByDoi, type OpenAlexConfig } from '@researchtrics/integration-openalex';
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
 * OpenAlex as a federation metadata provider (addendum §9). Wraps the existing
 * OpenAlex adapter; a scholarly-graph evidence source, never the sole source of
 * truth (§9). Polite pool + injectable HTTP for offline tests.
 */
export class OpenAlexMetadataProvider implements ScholarlyMetadataProvider {
  readonly name = 'openalex';
  readonly external = true;
  readonly capabilities: ProviderCapability[] = ['getWork', 'healthCheck'];

  constructor(
    private readonly config: OpenAlexConfig = { baseUrl: 'https://api.openalex.org' },
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async getWork(id: PersistentId): Promise<NormalizedWork> {
    if (!id.doi) throw new Error('OpenAlexMetadataProvider.getWork requires a DOI');
    const pub = await fetchByDoi(id.doi, this.config, this.fetchImpl);
    return toNormalizedWork(pub, this.name);
  }

  healthCheck(): Promise<ProviderHealth> {
    const base = (this.config.baseUrl ?? 'https://api.openalex.org').replace(/\/$/, '');
    const params = new URLSearchParams({ 'per-page': '1' });
    if (this.config.mailto) params.set('mailto', this.config.mailto);
    return timedHealthCheck(this.name, `${base}/works?${params.toString()}`, this.fetchImpl);
  }
}
