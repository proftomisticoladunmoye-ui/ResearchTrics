import { politeFetchJson } from '@researchtrics/integration-shared';
import type {
  ScholarlyMetadataProvider,
  ProviderCapability,
  ProviderHealth,
  NormalizedInstitution,
  InstitutionSearchQuery,
  PersistentId,
} from './types';
import { timedHealthCheck } from './health';

/**
 * ROR (Research Organization Registry) as a federation provider (addendum §8).
 * Normalizes institutional identity: resolves alternate names/acronyms to one
 * canonical institution with a stable ROR id. CC0 data. Injectable HTTP for
 * offline tests; endpoints to be re-verified against https://ror.readme.io/.
 */

export interface RORConfig {
  baseUrl?: string | undefined;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Strip a ROR id URL to the bare id (`https://ror.org/05a28r0s0` → `05a28r0s0`). */
export function bareRorId(id: unknown): string | undefined {
  if (typeof id !== 'string') return undefined;
  return id.replace(/^https?:\/\/ror\.org\//i, '');
}

/** Map one ROR organization record into a normalized institution. Pure + tested. */
export function mapRor(org: unknown): NormalizedInstitution {
  const o = org as any;
  const rorId = bareRorId(o?.id);
  const website = Array.isArray(o?.links) && typeof o.links[0] === 'string' ? o.links[0] : undefined;
  return {
    source: 'ror',
    rorId,
    name: typeof o?.name === 'string' ? o.name : '(unknown institution)',
    aliases: [
      ...(Array.isArray(o?.aliases) ? o.aliases : []),
      ...(Array.isArray(o?.labels) ? o.labels.map((l: any) => l?.label).filter(Boolean) : []),
    ],
    acronyms: Array.isArray(o?.acronyms) ? o.acronyms : [],
    country: typeof o?.country?.country_name === 'string' ? o.country.country_name : undefined,
    countryCode: typeof o?.country?.country_code === 'string' ? o.country.country_code : undefined,
    website,
    types: Array.isArray(o?.types) ? o.types : [],
    provenance: {
      source: 'ror',
      sourceId: rorId,
      sourceUrl: rorId ? `https://ror.org/${rorId}` : undefined,
      retrievedAt: new Date().toISOString(),
    },
  };
}

export class RORMetadataProvider implements ScholarlyMetadataProvider {
  readonly name = 'ror';
  readonly external = true;
  readonly capabilities: ProviderCapability[] = ['getInstitution', 'search', 'healthCheck'];

  constructor(
    private readonly config: RORConfig = {},
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private base(): string {
    return (this.config.baseUrl ?? 'https://api.ror.org').replace(/\/$/, '');
  }

  async getInstitution(id: PersistentId): Promise<NormalizedInstitution> {
    if (!id.ror) throw new Error('RORMetadataProvider.getInstitution requires a ROR id');
    const json = await politeFetchJson(`${this.base()}/organizations/${encodeURIComponent(bareRorId(id.ror) ?? id.ror)}`, {
      fetchImpl: this.fetchImpl,
    });
    return mapRor(json);
  }

  async searchInstitutions(query: InstitutionSearchQuery): Promise<NormalizedInstitution[]> {
    const params = new URLSearchParams({ query: query.name });
    const json = (await politeFetchJson(`${this.base()}/organizations?${params.toString()}`, {
      fetchImpl: this.fetchImpl,
    })) as any;
    const items: any[] = Array.isArray(json?.items) ? json.items : [];
    let results = items.map(mapRor);
    if (query.country) {
      const c = query.country.toLowerCase();
      results = results.filter(
        (r) => r.countryCode?.toLowerCase() === c || r.country?.toLowerCase() === c,
      );
    }
    return typeof query.limit === 'number' ? results.slice(0, query.limit) : results;
  }

  healthCheck(): Promise<ProviderHealth> {
    return timedHealthCheck(this.name, `${this.base()}/heartbeat`, this.fetchImpl);
  }
}
