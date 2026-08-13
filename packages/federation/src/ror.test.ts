import { describe, it, expect } from 'vitest';
import { mapRor, bareRorId, RORMetadataProvider } from './index';

function jsonFetch(payload: unknown): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } })) as unknown as typeof fetch;
}

const ORG = {
  id: 'https://ror.org/05a28r0s0',
  name: 'Kampala International University',
  aliases: ['Kampala Int. Univ.'],
  acronyms: ['KIU'],
  country: { country_name: 'Uganda', country_code: 'UG' },
  links: ['https://www.kiu.ac.ug/'],
  types: ['Education'],
};

describe('bareRorId + mapRor (§8)', () => {
  it('strips the ROR URL to the bare id', () => {
    expect(bareRorId('https://ror.org/05a28r0s0')).toBe('05a28r0s0');
    expect(bareRorId('05a28r0s0')).toBe('05a28r0s0');
  });

  it('maps an organization with aliases, acronyms, country, website', () => {
    const i = mapRor(ORG);
    expect(i.source).toBe('ror');
    expect(i.rorId).toBe('05a28r0s0');
    expect(i.name).toBe('Kampala International University');
    expect(i.aliases).toContain('Kampala Int. Univ.');
    expect(i.acronyms).toContain('KIU');
    expect(i.countryCode).toBe('UG');
    expect(i.website).toBe('https://www.kiu.ac.ug/');
    expect(i.provenance.sourceUrl).toBe('https://ror.org/05a28r0s0');
  });
});

describe('RORMetadataProvider (offline)', () => {
  it('searchInstitutions resolves name variants to the canonical org', async () => {
    const p = new RORMetadataProvider({}, jsonFetch({ items: [ORG] }));
    const results = await p.searchInstitutions({ name: 'KIU' });
    expect(results).toHaveLength(1);
    expect(results[0]!.rorId).toBe('05a28r0s0');
    expect(p.capabilities).toContain('getInstitution');
  });

  it('getInstitution returns a normalized institution by ROR id', async () => {
    const p = new RORMetadataProvider({}, jsonFetch(ORG));
    const i = await p.getInstitution({ ror: '05a28r0s0' });
    expect(i.name).toContain('Kampala');
  });

  it('filters search by country', async () => {
    const p = new RORMetadataProvider({}, jsonFetch({ items: [ORG] }));
    expect(await p.searchInstitutions({ name: 'x', country: 'US' })).toHaveLength(0);
    expect((await p.searchInstitutions({ name: 'x', country: 'UG' }))).toHaveLength(1);
  });
});
