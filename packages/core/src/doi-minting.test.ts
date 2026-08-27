import { describe, it, expect } from 'vitest';
import { buildDataCiteAttributes, dataCiteConfigFromEnv, isDataCiteMintConfigured, type MintablePublication } from './doi-minting';

const base: MintablePublication = {
  title: 'A Study of Things',
  slug: 'a-study-of-things-1',
  outputType: 'journal_article',
  abstract: 'We studied things.',
  publishedYear: 2021,
  publisher: null,
  journalName: 'Journal of Things',
  authors: [
    { rawName: 'Lovelace, Ada', givenName: null, familyName: null, orcid: '0000-0002-1825-0097' },
    { rawName: 'World Health Organization', givenName: null, familyName: null, orcid: null },
  ],
};

describe('buildDataCiteAttributes', () => {
  it('maps core fields to the DataCite schema', () => {
    const a = buildDataCiteAttributes(base, 'https://www.researchtrics.com/publications/a-study-of-things-1', '10.99999', true);
    expect(a.prefix).toBe('10.99999');
    expect(a.url).toContain('/publications/a-study-of-things-1');
    expect(a.titles).toEqual([{ title: 'A Study of Things' }]);
    expect(a.publisher).toBe('Journal of Things'); // falls back to journal when publisher absent
    expect(a.publicationYear).toBe(2021);
    expect((a.types as { resourceTypeGeneral: string }).resourceTypeGeneral).toBe('JournalArticle');
    expect(a.event).toBe('publish'); // findable
    expect(a.descriptions).toEqual([{ description: 'We studied things.', descriptionType: 'Abstract', lang: 'en' }]);
  });

  it('splits a "Family, Given" personal name and attaches ORCID', () => {
    const a = buildDataCiteAttributes(base, 'https://x/y', '10.1', false);
    const creators = a.creators as Array<Record<string, unknown>>;
    expect(creators.length).toBeGreaterThan(1);
    expect(creators[0]!).toMatchObject({ nameType: 'Personal', givenName: 'Ada', familyName: 'Lovelace' });
    expect((creators[0]!.nameIdentifiers as Array<{ nameIdentifier: string }>)[0]!.nameIdentifier).toBe(
      'https://orcid.org/0000-0002-1825-0097',
    );
  });

  it('treats a comma-less name as an organization', () => {
    const a = buildDataCiteAttributes(base, 'https://x/y', '10.1', false);
    const creators = a.creators as Array<Record<string, unknown>>;
    expect(creators.length).toBeGreaterThan(1);
    expect(creators[1]!).toMatchObject({ nameType: 'Organizational', name: 'World Health Organization' });
    expect(creators[1]!.givenName).toBeUndefined();
  });

  it('omits the publish event for a draft DOI', () => {
    const a = buildDataCiteAttributes(base, 'https://x/y', '10.1', false);
    expect(a.event).toBeUndefined();
  });

  it('defaults publication year and publisher when absent', () => {
    const a = buildDataCiteAttributes(
      { ...base, publishedYear: null, publisher: null, journalName: null },
      'https://x/y',
      '10.1',
      true,
    );
    expect(typeof a.publicationYear).toBe('number');
    expect(a.publisher).toBe('ResearchTrics');
  });

  it('maps a thesis to a DataCite Dissertation', () => {
    const a = buildDataCiteAttributes({ ...base, outputType: 'thesis' }, 'https://x/y', '10.1', true);
    expect((a.types as { resourceTypeGeneral: string }).resourceTypeGeneral).toBe('Dissertation');
  });
});

describe('dataCiteConfigFromEnv', () => {
  it('is null unless all four vars are present', () => {
    expect(dataCiteConfigFromEnv({})).toBeNull();
    expect(isDataCiteMintConfigured({ DATACITE_ENDPOINT: 'https://api.test.datacite.org' })).toBe(false);
    const full = {
      DATACITE_ENDPOINT: 'https://api.test.datacite.org/',
      DATACITE_REPOSITORY_ID: 'ABC.DEF',
      DATACITE_PASSWORD: 'secret',
      DATACITE_PREFIX: '10.99999',
    };
    expect(dataCiteConfigFromEnv(full)).toEqual({
      endpoint: 'https://api.test.datacite.org', // trailing slash trimmed
      repositoryId: 'ABC.DEF',
      password: 'secret',
      prefix: '10.99999',
    });
  });
});
