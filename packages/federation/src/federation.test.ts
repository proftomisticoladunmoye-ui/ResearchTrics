import { describe, it, expect } from 'vitest';
import {
  toNormalizedWork,
  timedHealthCheck,
  CrossrefMetadataProvider,
  OpenAlexMetadataProvider,
  createFederationProvider,
  allFederationProviders,
} from './index';
import type { NormalizedPublication } from '@researchtrics/integration-shared';

function jsonFetch(payload: unknown, status = 200): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { 'content-type': 'application/json' },
    })) as unknown as typeof fetch;
}

const PUB: NormalizedPublication = {
  source: 'crossref',
  title: 'A study of measurement invariance',
  doi: '10.1234/x',
  openAlexId: 'W123',
  journalTitle: 'Journal of Testing',
  publishedYear: 2020,
  citationCount: 12,
  authors: [{ rawName: 'Ada Lovelace', orcid: '0000-0002-1825-0097' }],
  raw: {},
};

describe('toNormalizedWork (§16, §30)', () => {
  it('maps a normalized publication into a work with external IDs + provenance', () => {
    const w = toNormalizedWork(PUB, 'crossref');
    expect(w.resourceType).toBe('publication');
    expect(w.title).toBe('A study of measurement invariance');
    expect(w.externalIds.doi).toBe('10.1234/x');
    expect(w.externalIds.openalex).toBe('W123');
    expect(w.authors[0]!.orcid).toBe('0000-0002-1825-0097');
    expect(w.citationCount).toBe(12); // source-specific, not merged
    expect(w.provenance.source).toBe('crossref');
    expect(w.provenance.sourceUrl).toBe('https://doi.org/10.1234/x');
  });
});

describe('timedHealthCheck (§34)', () => {
  it('reports healthy on a 200', async () => {
    const h = await timedHealthCheck('crossref', 'https://x/works', jsonFetch({ ok: true }));
    expect(h.status).toBe('healthy');
    expect(h.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('reports warning on a 4xx and down on a 5xx', async () => {
    expect((await timedHealthCheck('x', 'https://x', jsonFetch({}, 429))).status).toBe('warning');
    expect((await timedHealthCheck('x', 'https://x', jsonFetch({}, 503))).status).toBe('down');
  });

  it('reports down when the request throws', async () => {
    const throwing = (async () => {
      throw new Error('ECONNREFUSED');
    }) as unknown as typeof fetch;
    const h = await timedHealthCheck('x', 'https://x', throwing);
    expect(h.status).toBe('down');
    expect(h.error).toContain('ECONNREFUSED');
  });
});

// A minimal Crossref work message that the adapter's mapper accepts.
const CROSSREF_MSG = {
  message: {
    DOI: '10.1234/x',
    title: ['A study of measurement invariance'],
    'container-title': ['Journal of Testing'],
    author: [{ given: 'Ada', family: 'Lovelace', ORCID: 'http://orcid.org/0000-0002-1825-0097' }],
    issued: { 'date-parts': [[2020]] },
    'is-referenced-by-count': 12,
  },
};

// A minimal OpenAlex work object.
const OPENALEX_WORK = {
  id: 'https://openalex.org/W123',
  doi: 'https://doi.org/10.1234/x',
  title: 'A study of measurement invariance',
  publication_year: 2020,
  cited_by_count: 15,
  authorships: [{ author: { display_name: 'Ada Lovelace', orcid: 'https://orcid.org/0000-0002-1825-0097' } }],
};

describe('federation providers (offline via injected fetch)', () => {
  it('CrossrefMetadataProvider.getWork returns a normalized work', async () => {
    const p = new CrossrefMetadataProvider({ baseUrl: 'https://api.crossref.org' }, jsonFetch(CROSSREF_MSG));
    const w = await p.getWork({ doi: '10.1234/x' });
    expect(w.source).toBe('crossref');
    expect(w.title).toContain('measurement invariance');
    expect(w.externalIds.doi).toBe('10.1234/x');
    expect(p.capabilities).toContain('getWork');
  });

  it('OpenAlexMetadataProvider.getWork returns a normalized work', async () => {
    const p = new OpenAlexMetadataProvider({ baseUrl: 'https://api.openalex.org' }, jsonFetch(OPENALEX_WORK));
    const w = await p.getWork({ doi: '10.1234/x' });
    expect(w.source).toBe('openalex');
    expect(w.title).toContain('measurement invariance');
    expect(p.external).toBe(true); // OpenAlex is an external provider
  });

  it('getWork without a DOI throws', async () => {
    const p = new CrossrefMetadataProvider(undefined, jsonFetch(CROSSREF_MSG));
    await expect(p.getWork({})).rejects.toThrow(/DOI/);
  });
});

describe('createFederationProvider factory (§2)', () => {
  it('resolves providers by name and exposes capabilities + health', () => {
    expect(createFederationProvider('crossref').name).toBe('crossref');
    expect(createFederationProvider('openalex').external).toBe(true);
    const all = allFederationProviders();
    expect(all.map((p) => p.name).sort()).toEqual(['crossref', 'datacite', 'openalex']);
    expect(all.every((p) => p.capabilities.includes('healthCheck'))).toBe(true);
  });
});
