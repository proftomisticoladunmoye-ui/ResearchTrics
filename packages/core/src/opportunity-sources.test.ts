import { describe, it, expect } from 'vitest';
import {
  mapGrantsGov,
  GrantsGovProvider,
  mapEuFunding,
  EuFundingProvider,
  FixtureOpportunityProvider,
  createOpportunityProvider,
} from './opportunity-sources';

describe('mapGrantsGov', () => {
  it('maps a hit to a normalized opportunity with US-date parsing', () => {
    const o = mapGrantsGov({
      id: 12345,
      title: '  Basic Research Grant  ',
      agencyName: 'National Science Foundation',
      openDate: '01/15/2026',
      closeDate: '06/30/2026',
    });
    expect(o).not.toBeNull();
    expect(o!.externalId).toBe('12345');
    expect(o!.title).toBe('Basic Research Grant');
    expect(o!.type).toBe('grant');
    expect(o!.country).toBe('US');
    expect(o!.organization).toBe('National Science Foundation');
    expect(o!.url).toContain('/search-results-detail/12345');
    expect(o!.deadline?.getUTCFullYear()).toBe(2026);
    expect(o!.deadline?.getUTCMonth()).toBe(5); // June (0-indexed)
  });

  it('drops records without a title or id', () => {
    expect(mapGrantsGov({ id: 1 })).toBeNull();
    expect(mapGrantsGov({ title: 'No id' })).toBeNull();
  });

  it('tolerates missing/invalid dates', () => {
    const o = mapGrantsGov({ number: 'ABC-1', title: 'Call', closeDate: 'not-a-date' });
    expect(o!.externalId).toBe('ABC-1');
    expect(o!.deadline).toBeUndefined();
  });
});

describe('GrantsGovProvider (injected fetch — offline)', () => {
  it('posts to search2 and returns mapped opportunities', async () => {
    let calledUrl = '';
    const fakeFetch = (async (url: string, init?: RequestInit) => {
      calledUrl = url;
      expect(init?.method).toBe('POST');
      return {
        ok: true,
        json: async () => ({
          data: {
            oppHits: [
              { id: 1, title: 'Grant A', closeDate: '12/31/2026' },
              { id: 2, title: 'Grant B' },
              { title: 'no id — dropped' },
            ],
          },
        }),
      };
    }) as unknown as typeof fetch;

    const provider = new GrantsGovProvider({ fetchImpl: fakeFetch });
    const items = await provider.fetchOpportunities({ keyword: 'physics', rows: 10 });
    expect(calledUrl).toContain('/search2');
    expect(items).toHaveLength(2);
    expect(items[0]!.title).toBe('Grant A');
  });

  it('throws on a non-ok response', async () => {
    const fakeFetch = (async () => ({ ok: false, status: 503 })) as unknown as typeof fetch;
    const provider = new GrantsGovProvider({ fetchImpl: fakeFetch });
    await expect(provider.fetchOpportunities({})).rejects.toThrow('503');
  });
});

describe('mapEuFunding (SEDIA metadata-array shape)', () => {
  it('maps an open call with ISO deadline parsing', () => {
    const o = mapEuFunding({
      reference: 'ref-1',
      url: 'https://ec.europa.eu/info/funding-tenders/opportunities/portal/x',
      metadata: {
        identifier: ['HORIZON-CL1-2026'],
        title: ['Digital Health Call'],
        status: ['31094502'], // open
        deadlineDate: ['2026-09-15T17:00:00+02:00'],
      },
    });
    expect(o).not.toBeNull();
    expect(o!.externalId).toBe('HORIZON-CL1-2026');
    expect(o!.title).toBe('Digital Health Call');
    expect(o!.country).toBe('EU');
    expect(o!.organization).toBe('European Commission');
    expect(o!.deadline?.getUTCFullYear()).toBe(2026);
  });

  it('skips closed calls and records missing title/id', () => {
    expect(mapEuFunding({ metadata: { status: ['31094503'], title: ['Closed'], identifier: ['x'] } })).toBeNull();
    expect(mapEuFunding({ metadata: { identifier: ['no-title'] } })).toBeNull();
  });

  it('tolerates missing/invalid deadline', () => {
    const o = mapEuFunding({ reference: 'r', metadata: { title: ['Call'], deadlineDate: ['bad'] } });
    expect(o!.deadline).toBeUndefined();
  });
});

describe('EuFundingProvider (injected fetch — offline)', () => {
  it('posts to the SEDIA search endpoint and maps results', async () => {
    let calledUrl = '';
    const fakeFetch = (async (url: string) => {
      calledUrl = url;
      return {
        ok: true,
        json: async () => ({
          results: [
            { reference: 'A', url: 'https://ec.europa.eu/a', metadata: { title: ['Call A'], identifier: ['A'], status: ['31094502'] } },
            { reference: 'C', metadata: { title: ['Closed C'], identifier: ['C'], status: ['31094503'] } },
          ],
        }),
      };
    }) as unknown as typeof fetch;
    const items = await new EuFundingProvider({ fetchImpl: fakeFetch }).fetchOpportunities({ rows: 5 });
    expect(calledUrl).toContain('apiKey=SEDIA');
    expect(items).toHaveLength(1); // closed one dropped
    expect(items[0]!.title).toBe('Call A');
  });
});

describe('provider factory + fixture', () => {
  it('fixture returns deterministic sample data', async () => {
    const items = await new FixtureOpportunityProvider().fetchOpportunities({});
    expect(items.length).toBeGreaterThan(0);
    expect(items[0]!.type).toBe('grant');
  });
  it('factory resolves names', () => {
    expect(createOpportunityProvider('grants_gov').name).toBe('grants_gov');
    expect(createOpportunityProvider('eu_funding').name).toBe('eu_funding');
    expect(createOpportunityProvider('fixture').name).toBe('fixture');
  });
});
