import { describe, it, expect } from 'vitest';
import { mapOpenAlex, reconstructAbstract } from './index';

describe('reconstructAbstract', () => {
  it('rebuilds text from an inverted index', () => {
    const inverted = { Measurement: [0], invariance: [1], matters: [2] };
    expect(reconstructAbstract(inverted)).toBe('Measurement invariance matters');
  });
  it('returns undefined for empty/absent input', () => {
    expect(reconstructAbstract(undefined)).toBeUndefined();
    expect(reconstructAbstract({})).toBeUndefined();
  });
});

describe('mapOpenAlex', () => {
  it('maps citation count, ids and biblio', () => {
    const work = {
      id: 'https://openalex.org/W123',
      doi: 'https://doi.org/10.1/AbC',
      display_name: 'Title Here',
      cited_by_count: 7,
      publication_year: 2021,
      type: 'article',
      primary_location: { source: { display_name: 'Some Journal', issn_l: '1111-2222' } },
      biblio: { volume: '3', issue: '1', first_page: '10', last_page: '20' },
      authorships: [
        { author: { display_name: 'Ada Lovelace', orcid: 'https://orcid.org/0000-0002-1825-0097' } },
      ],
    };
    const p = mapOpenAlex(work);
    expect(p.openAlexId).toBe('W123');
    expect(p.doi).toBe('10.1/abc');
    expect(p.citationCount).toBe(7);
    expect(p.journalTitle).toBe('Some Journal');
    expect(p.firstPage).toBe('10');
    expect(p.authors[0]?.orcid).toBe('0000-0002-1825-0097');
    expect(p.source).toBe('openalex');
  });
});
