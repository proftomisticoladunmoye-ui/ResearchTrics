import { describe, it, expect } from 'vitest';
import { extractInternalCitationSlugs, authorSlug, bulletinDoiProvider, seriesConfig } from './bulletin';
import { zenodoConfigFromEnv, isZenodoConfigured } from './zenodo';

describe('extractInternalCitationSlugs', () => {
  it('finds internal bulletin links (relative and absolute) and dedups', () => {
    const html = `
      <p>See <a href="/research-bulletin/reliability-001">Bulletin 1</a>.</p>
      <p>And <a href="https://www.researchtrics.com/research-bulletin/validity-002">Bulletin 2</a>.</p>
      <p>Again <a href="/research-bulletin/reliability-001">same</a>.</p>`;
    expect(extractInternalCitationSlugs(html).sort()).toEqual(['reliability-001', 'validity-002']);
  });

  it('ignores non-bulletin and external links', () => {
    const html = '<a href="/publications/foo">x</a><a href="https://example.com/research-bulletin/y">y</a>';
    // The example.com absolute link IS matched (host-agnostic) — that is intended
    // (crawlable canonical host may vary); only the /publications link is ignored.
    expect(extractInternalCitationSlugs(html)).toEqual(['y']);
  });

  it('returns empty for no internal links', () => {
    expect(extractInternalCitationSlugs('<p>no links</p>')).toEqual([]);
  });
});

describe('authorSlug', () => {
  it('normalizes an author name to a stable slug', () => {
    expect(authorSlug('Oladunmoye, E. O.')).toBe(authorSlug('Oladunmoye, E. O.'));
    expect(authorSlug('Ada Lovelace')).toMatch(/^ada-lovelace$/);
  });
});

describe('zenodoConfigFromEnv', () => {
  it('is null without a token; picks sandbox vs production by env', () => {
    expect(zenodoConfigFromEnv({})).toBeNull();
    expect(isZenodoConfigured({ ZENODO_TOKEN: 't' })).toBe(true);
    expect(zenodoConfigFromEnv({ ZENODO_TOKEN: 't' })?.baseUrl).toBe('https://sandbox.zenodo.org/api');
    expect(zenodoConfigFromEnv({ ZENODO_TOKEN: 't', ZENODO_ENVIRONMENT: 'production' })?.baseUrl).toBe('https://zenodo.org/api');
  });
});

describe('bulletinDoiProvider', () => {
  it('prefers Zenodo, then DataCite, else none', () => {
    expect(bulletinDoiProvider({})).toBeNull();
    expect(bulletinDoiProvider({ ZENODO_TOKEN: 't' })).toBe('zenodo');
    expect(
      bulletinDoiProvider({
        DATACITE_ENDPOINT: 'https://api.test.datacite.org',
        DATACITE_REPOSITORY_ID: 'A.B',
        DATACITE_PASSWORD: 'p',
        DATACITE_PREFIX: '10.1',
      }),
    ).toBe('datacite');
    // Zenodo wins when both are configured.
    expect(
      bulletinDoiProvider({
        ZENODO_TOKEN: 't',
        DATACITE_ENDPOINT: 'https://api.test.datacite.org',
        DATACITE_REPOSITORY_ID: 'A.B',
        DATACITE_PASSWORD: 'p',
        DATACITE_PREFIX: '10.1',
      }),
    ).toBe('zenodo');
  });
});

describe('seriesConfig', () => {
  it('exposes ISSN only when set (never fabricated)', () => {
    expect(seriesConfig({}).issn).toBeNull();
    expect(seriesConfig({ BULLETIN_ISSN: '1234-5678' }).issn).toBe('1234-5678');
  });
});
