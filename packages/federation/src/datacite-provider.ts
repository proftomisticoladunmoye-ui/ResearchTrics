import { politeFetchJson } from '@researchtrics/integration-shared';
import type {
  ScholarlyMetadataProvider,
  ProviderCapability,
  ProviderHealth,
  NormalizedWork,
  NormalizedWorkAuthor,
  PersistentId,
  ResourceType,
  WorkSearchQuery,
} from './types';
import { timedHealthCheck } from './health';

/**
 * DataCite as a federation metadata provider (addendum §4, §5). DataCite is a
 * first-class source for **research objects** — datasets, software, reports —
 * registered as DOIs. Evidence for DOI research objects (§37); not authoritative
 * for identity. Injectable HTTP for offline tests; endpoints to be re-verified
 * against https://support.datacite.org/docs/api.
 */

export interface DataCiteConfig {
  baseUrl?: string | undefined;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/** DataCite `resourceTypeGeneral` → our resource type. */
function resourceTypeOf(attributes: any): ResourceType {
  const general = String(attributes?.types?.resourceTypeGeneral ?? '').toLowerCase();
  switch (general) {
    case 'dataset':
      return 'dataset';
    case 'software':
      return 'software';
    case 'text':
    case 'journalarticle':
    case 'preprint':
      return 'publication';
    case 'report':
      return 'report';
    default:
      return 'other';
  }
}

function authorsOf(attributes: any): NormalizedWorkAuthor[] {
  const creators: any[] = Array.isArray(attributes?.creators) ? attributes.creators : [];
  return creators.map((c) => {
    const orcidId = (Array.isArray(c?.nameIdentifiers) ? c.nameIdentifiers : []).find(
      (n: any) => String(n?.nameIdentifierScheme ?? '').toUpperCase() === 'ORCID',
    )?.nameIdentifier;
    const orcid =
      typeof orcidId === 'string' ? orcidId.replace(/^https?:\/\/orcid\.org\//i, '') : undefined;
    const author: NormalizedWorkAuthor = { rawName: c?.name ?? 'Unknown' };
    if (orcid) author.orcid = orcid;
    if (typeof c?.affiliation?.[0]?.name === 'string') author.affiliation = c.affiliation[0].name;
    return author;
  });
}

/** Map one DataCite record (`{ id, attributes }`) into a normalized work. Pure + tested. */
export function mapDataCite(record: unknown): NormalizedWork {
  const r = record as any;
  const attributes = r?.attributes ?? r;
  const doi: string | undefined = typeof attributes?.doi === 'string' ? attributes.doi : r?.id;
  const title = Array.isArray(attributes?.titles) ? attributes.titles[0]?.title : attributes?.title;
  const description = Array.isArray(attributes?.descriptions)
    ? attributes.descriptions[0]?.description
    : undefined;

  const work: NormalizedWork = {
    source: 'datacite',
    resourceType: resourceTypeOf(attributes),
    title: typeof title === 'string' ? title : '(untitled)',
    abstract: typeof description === 'string' ? description : undefined,
    publishedYear: typeof attributes?.publicationYear === 'number' ? attributes.publicationYear : undefined,
    publisher: typeof attributes?.publisher === 'string' ? attributes.publisher : undefined,
    externalIds: { doi, datacite: doi },
    authors: authorsOf(attributes),
    provenance: {
      source: 'datacite',
      sourceId: doi,
      sourceUrl: doi ? `https://doi.org/${doi}` : undefined,
      retrievedAt: new Date().toISOString(),
    },
    raw: record,
  };
  return work;
}

export class DataCiteMetadataProvider implements ScholarlyMetadataProvider {
  readonly name = 'datacite';
  readonly external = true;
  readonly capabilities: ProviderCapability[] = ['getWork', 'search', 'healthCheck'];

  constructor(
    private readonly config: DataCiteConfig = {},
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private base(): string {
    return (this.config.baseUrl ?? 'https://api.datacite.org').replace(/\/$/, '');
  }

  async getWork(id: PersistentId): Promise<NormalizedWork> {
    if (!id.doi) throw new Error('DataCiteMetadataProvider.getWork requires a DOI');
    const json = (await politeFetchJson(`${this.base()}/dois/${encodeURIComponent(id.doi)}`, {
      fetchImpl: this.fetchImpl,
    })) as any;
    return mapDataCite(json?.data ?? json);
  }

  async searchWorks(query: WorkSearchQuery): Promise<NormalizedWork[]> {
    const params = new URLSearchParams();
    if (query.orcid) {
      params.set('query', `creators.nameIdentifiers.nameIdentifier:"https://orcid.org/${query.orcid}"`);
    } else if (query.name) {
      params.set('query', `creators.name:"${query.name}"`);
    }
    params.set('page[size]', String(Math.min(query.limit ?? 25, 100)));
    const json = (await politeFetchJson(`${this.base()}/dois?${params.toString()}`, {
      fetchImpl: this.fetchImpl,
    })) as any;
    const items: any[] = Array.isArray(json?.data) ? json.data : [];
    let works = items.map(mapDataCite);
    if (query.resourceTypes && query.resourceTypes.length > 0) {
      works = works.filter((w) => query.resourceTypes!.includes(w.resourceType));
    }
    return works;
  }

  healthCheck(): Promise<ProviderHealth> {
    return timedHealthCheck(this.name, `${this.base()}/heartbeat`, this.fetchImpl);
  }
}
