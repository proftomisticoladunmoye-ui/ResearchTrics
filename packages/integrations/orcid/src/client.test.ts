import { describe, it, expect } from 'vitest';
import { buildAuthUrl, normalizeRecord } from './client';
import type { OrcidConfig } from './config';

const config: OrcidConfig = {
  environment: 'sandbox',
  clientId: 'APP-TEST',
  clientSecret: 'secret',
  redirectUri: 'http://localhost:3000/api/v1/integrations/orcid/callback',
  authorizeUrl: 'https://sandbox.orcid.org/oauth/authorize',
  tokenUrl: 'https://sandbox.orcid.org/oauth/token',
  publicApiBase: 'https://pub.sandbox.orcid.org/v3.0',
};

describe('buildAuthUrl', () => {
  it('builds an /authenticate authorization URL with all required params', () => {
    const url = new URL(buildAuthUrl(config, 'state-123'));
    expect(url.origin + url.pathname).toBe('https://sandbox.orcid.org/oauth/authorize');
    expect(url.searchParams.get('client_id')).toBe('APP-TEST');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('scope')).toBe('/authenticate');
    expect(url.searchParams.get('redirect_uri')).toBe(config.redirectUri);
    expect(url.searchParams.get('state')).toBe('state-123');
  });
});

describe('normalizeRecord', () => {
  it('extracts name, biography and keywords from the nested record', () => {
    const record = {
      person: {
        name: {
          'given-names': { value: 'Ada' },
          'family-name': { value: 'Lovelace' },
        },
        biography: { content: 'Mathematician.' },
        keywords: { keyword: [{ content: 'analytical engines' }, { content: 'algorithms' }] },
      },
    };
    const p = normalizeRecord(record);
    expect(p.givenNames).toBe('Ada');
    expect(p.familyName).toBe('Lovelace');
    expect(p.biography).toBe('Mathematician.');
    expect(p.keywords).toEqual(['analytical engines', 'algorithms']);
  });

  it('is robust to missing sections', () => {
    expect(normalizeRecord({}).keywords).toEqual([]);
    expect(normalizeRecord(null).givenNames).toBeUndefined();
  });
});
