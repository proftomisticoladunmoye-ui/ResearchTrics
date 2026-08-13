import { describe, it, expect } from 'vitest';
import {
  mapOpenAlexAuthor,
  buildOpenAlexAuthorsUrl,
  OpenAlexDiscoveryProvider,
  extractCrossrefAuthors,
  buildCrossrefWorksUrl,
  CrossrefDiscoveryProvider,
  createDiscoveryProvider,
} from './index';

/** A fetch stub that returns canned JSON — no network in tests. */
function stubFetch(payload: unknown): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })) as unknown as typeof fetch;
}

const OPENALEX_AUTHOR = {
  id: 'https://openalex.org/A5000000009',
  display_name: 'Jane A. Smith',
  orcid: 'https://orcid.org/0000-0002-1111-2222',
  works_count: 34,
  last_known_institutions: [{ display_name: 'University X', country_code: 'GB', ror: 'https://ror.org/xxx' }],
  x_concepts: [{ display_name: 'Psychometrics' }, { display_name: 'Education' }],
};

describe('OpenAlex discovery mapping (§6)', () => {
  it('maps an author, stripping id/orcid URLs and carrying provenance', () => {
    const c = mapOpenAlexAuthor(OPENALEX_AUTHOR);
    expect(c.fullName).toBe('Jane A. Smith');
    expect(c.openalexAuthorId).toBe('A5000000009');
    expect(c.orcid).toBe('0000-0002-1111-2222');
    expect(c.institution).toBe('University X');
    expect(c.country).toBe('GB');
    expect(c.topics).toContain('Psychometrics');
    expect(c.publicationCount).toBe(34);
    expect(c.provenance.source).toBe('openalex');
    expect(c.provenance.sourceUrl).toBe('https://openalex.org/A5000000009');
  });

  it('builds a filtered authors URL with the polite mailto', () => {
    const url = buildOpenAlexAuthorsUrl(
      { rorId: 'https://ror.org/xxx', country: 'GB', limit: 10 },
      { mailto: 'ops@researchtrics.test' },
    );
    expect(url).toContain('/authors?');
    expect(url).toContain('last_known_institutions.ror');
    expect(url).toContain('mailto=ops%40researchtrics.test');
    expect(url).toContain('per-page=10');
  });

  it('provider.discover maps results offline via injected fetch', async () => {
    const provider = new OpenAlexDiscoveryProvider({}, stubFetch({ results: [OPENALEX_AUTHOR] }));
    const out = await provider.discover({ limit: 1 });
    expect(out).toHaveLength(1);
    expect(out[0]!.orcid).toBe('0000-0002-1111-2222');
    expect(provider.external).toBe(true);
  });
});

const CROSSREF_WORKS = {
  message: {
    items: [
      {
        DOI: '10.1000/a',
        title: ['A paper on measurement'],
        subject: ['Psychology'],
        issued: { 'date-parts': [[2020]] },
        author: [
          { given: 'Jane', family: 'Smith', ORCID: 'http://orcid.org/0000-0002-1111-2222', affiliation: [{ name: 'University X' }] },
          { given: 'Ravi', family: 'Kumar' },
        ],
      },
      {
        DOI: '10.1000/b',
        title: ['A second paper'],
        author: [{ given: 'Jane', family: 'Smith', ORCID: 'http://orcid.org/0000-0002-1111-2222' }],
      },
    ],
  },
};

describe('Crossref discovery extraction (§7)', () => {
  it('extracts distinct authors keyed by ORCID, accumulating works and co-authors', () => {
    const authors = extractCrossrefAuthors(CROSSREF_WORKS);
    const jane = authors.find((a) => a.orcid === '0000-0002-1111-2222')!;
    expect(jane).toBeDefined();
    expect(jane.fullName).toBe('Jane Smith');
    expect(jane.works).toHaveLength(2); // appears in both works
    expect(jane.coauthors).toContain('Ravi Kumar');
    expect(jane.institution).toBe('University X');
    expect(jane.topics).toContain('psychology');
    expect(jane.provenance.source).toBe('crossref');
  });

  it('keys authors without ORCID by name', () => {
    const authors = extractCrossrefAuthors(CROSSREF_WORKS);
    expect(authors.some((a) => a.fullName === 'Ravi Kumar' && !a.orcid)).toBe(true);
  });

  it('builds a works URL filtered by affiliation', () => {
    const url = buildCrossrefWorksUrl({ institution: 'University X', limit: 5 }, { mailto: 'ops@x.test' });
    expect(url).toContain('query.affiliation=University+X');
    expect(url).toContain('rows=5');
  });

  it('provider.discover extracts offline via injected fetch', async () => {
    const provider = new CrossrefDiscoveryProvider({}, stubFetch(CROSSREF_WORKS));
    const out = await provider.discover({ institution: 'University X' });
    expect(out.length).toBeGreaterThanOrEqual(2);
  });
});

describe('createDiscoveryProvider factory (§39)', () => {
  it('returns the offline fixture provider by default', () => {
    expect(createDiscoveryProvider('fixture').external).toBe(false);
  });
  it('returns external live providers by name', () => {
    expect(createDiscoveryProvider('openalex').name).toBe('openalex');
    expect(createDiscoveryProvider('crossref').external).toBe(true);
  });
});
