import { describe, it, expect } from 'vitest';
import { mapDataCite, DataCiteMetadataProvider } from './index';

function jsonFetch(payload: unknown, status = 200): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { 'content-type': 'application/json' },
    })) as unknown as typeof fetch;
}

const DATASET = {
  id: '10.5555/data.1',
  attributes: {
    doi: '10.5555/data.1',
    titles: [{ title: 'Cross-cultural sample 2020' }],
    creators: [
      { name: 'Lovelace, Ada', nameIdentifiers: [{ nameIdentifier: 'https://orcid.org/0000-0002-1825-0097', nameIdentifierScheme: 'ORCID' }] },
    ],
    publisher: 'ResearchTrics',
    publicationYear: 2020,
    types: { resourceTypeGeneral: 'Dataset' },
    descriptions: [{ description: 'A cross-cultural dataset.' }],
  },
};

const SOFTWARE = {
  id: '10.5555/soft.1',
  attributes: {
    doi: '10.5555/soft.1',
    titles: [{ title: 'invariance-r' }],
    creators: [{ name: 'Lovelace, Ada' }],
    types: { resourceTypeGeneral: 'Software' },
  },
};

describe('mapDataCite (§4, §5)', () => {
  it('maps a dataset with resourceType, ORCID creator, and provenance', () => {
    const w = mapDataCite(DATASET);
    expect(w.source).toBe('datacite');
    expect(w.resourceType).toBe('dataset');
    expect(w.title).toBe('Cross-cultural sample 2020');
    expect(w.externalIds.doi).toBe('10.5555/data.1');
    expect(w.externalIds.datacite).toBe('10.5555/data.1');
    expect(w.authors[0]!.orcid).toBe('0000-0002-1825-0097');
    expect(w.provenance.sourceUrl).toBe('https://doi.org/10.5555/data.1');
  });

  it('classifies software resource type', () => {
    expect(mapDataCite(SOFTWARE).resourceType).toBe('software');
  });
});

describe('DataCiteMetadataProvider (offline)', () => {
  it('getWork returns a normalized research object', async () => {
    const p = new DataCiteMetadataProvider({}, jsonFetch({ data: DATASET }));
    const w = await p.getWork({ doi: '10.5555/data.1' });
    expect(w.resourceType).toBe('dataset');
    expect(p.capabilities).toContain('search');
  });

  it('searchWorks filters by resource type', async () => {
    const p = new DataCiteMetadataProvider({}, jsonFetch({ data: [DATASET, SOFTWARE] }));
    const datasets = await p.searchWorks({ orcid: '0000-0002-1825-0097', resourceTypes: ['dataset'] });
    expect(datasets).toHaveLength(1);
    expect(datasets[0]!.resourceType).toBe('dataset');

    const both = await p.searchWorks({ orcid: '0000-0002-1825-0097' });
    expect(both.length).toBe(2);
  });
});
