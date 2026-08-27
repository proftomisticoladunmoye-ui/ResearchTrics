import { describe, it, expect } from 'vitest';
import { buildAuthUrl, normalizeRecord, buildWorkPayload, orcidWorkType } from './client';
import type { OrcidConfig } from './config';

const config: OrcidConfig = {
  environment: 'sandbox',
  clientId: 'APP-TEST',
  clientSecret: 'secret',
  redirectUri: 'http://localhost:3000/api/v1/integrations/orcid/callback',
  authorizeUrl: 'https://sandbox.orcid.org/oauth/authorize',
  tokenUrl: 'https://sandbox.orcid.org/oauth/token',
  publicApiBase: 'https://pub.sandbox.orcid.org/v3.0',
  memberApiBase: 'https://api.sandbox.orcid.org/v3.0',
  scope: '/authenticate',
  workSyncEnabled: false,
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

  it('requests the update scope when work sync is enabled', () => {
    const url = new URL(buildAuthUrl({ ...config, scope: '/authenticate /activities/update' }, 's'));
    expect(url.searchParams.get('scope')).toBe('/authenticate /activities/update');
  });
});

describe('buildWorkPayload', () => {
  it('maps a DOI work to the ORCID v3.0 schema with a self external-id', () => {
    const work = buildWorkPayload({
      title: 'On Analytical Engines',
      outputType: 'journal_article',
      publishedYear: 1843,
      journalName: 'Memoirs',
      doi: '10.1234/x',
      landingUrl: 'https://www.researchtrics.com/publications/on-analytical-engines-1',
    });
    expect(work).toMatchObject({
      title: { title: { value: 'On Analytical Engines' } },
      type: 'journal-article',
      'journal-title': { value: 'Memoirs' },
      'publication-date': { year: { value: '1843' } },
      url: { value: 'https://www.researchtrics.com/publications/on-analytical-engines-1' },
    });
    const ids = (work['external-ids'] as { 'external-id': Array<Record<string, string>> })['external-id'];
    expect(ids[0]).toEqual({ 'external-id-type': 'doi', 'external-id-value': '10.1234/x', 'external-id-relationship': 'self' });
    expect(ids[1]!['external-id-type']).toBe('uri'); // landing URL as fallback id
  });

  it('uses the landing URL as the only external-id when there is no DOI', () => {
    const work = buildWorkPayload({
      title: 'A Book',
      outputType: 'book',
      publishedYear: null,
      journalName: null,
      doi: null,
      landingUrl: 'https://x/y',
    });
    const ids = (work['external-ids'] as { 'external-id': Array<Record<string, string>> })['external-id'];
    expect(ids).toHaveLength(1);
    expect(ids[0]!['external-id-type']).toBe('uri');
    expect(work.type).toBe('book');
    expect(work['publication-date']).toBeUndefined();
  });

  it('maps output types to ORCID work types', () => {
    expect(orcidWorkType('thesis')).toBe('dissertation-thesis');
    expect(orcidWorkType('dataset')).toBe('data-set');
    expect(orcidWorkType('software')).toBe('software');
    expect(orcidWorkType('mystery')).toBe('other');
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
