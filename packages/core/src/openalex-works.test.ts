import { describe, it, expect } from 'vitest';
import { reconstructAbstract, mapOpenAlexWork } from './openalex-works';

describe('reconstructAbstract', () => {
  it('rebuilds text from an inverted index in position order', () => {
    expect(reconstructAbstract({ Hello: [0], world: [1], again: [2, 4], hello: [3] })).toBe(
      'Hello world again hello again',
    );
  });
  it('returns undefined for empty/invalid input', () => {
    expect(reconstructAbstract(null)).toBeUndefined();
    expect(reconstructAbstract({})).toBeUndefined();
    expect(reconstructAbstract('nope')).toBeUndefined();
  });
});

describe('mapOpenAlexWork', () => {
  const work = {
    id: 'https://openalex.org/W123',
    doi: 'https://doi.org/10.1/ABC',
    title: 'A Study of Things',
    type: 'article',
    publication_year: 2025,
    publication_date: '2025-03-01',
    cited_by_count: 42,
    open_access: { is_oa: true, oa_url: 'https://example.org/x.pdf' },
    primary_location: { source: { display_name: 'Nature', issn_l: '0028-0836' }, pdf_url: null },
    abstract_inverted_index: { We: [0], measured: [1] },
    authorships: [
      { author: { display_name: 'Jane Doe', orcid: 'https://orcid.org/0000-0002-1825-0097' }, institutions: [{ display_name: 'MIT' }] },
      { author: { display_name: 'John Roe' } },
    ],
  };

  it('maps core fields with normalized DOI + OpenAlex id', () => {
    const p = mapOpenAlexWork(work)!;
    expect(p.title).toBe('A Study of Things');
    expect(p.doi).toBe('10.1/abc');
    expect(p.openAlexId).toBe('W123');
    expect(p.outputType).toBe('journal_article');
    expect(p.journalTitle).toBe('Nature');
    expect(p.publishedYear).toBe(2025);
    expect(p.openAccess).toBe(true);
    expect(p.pdfUrl).toBe('https://example.org/x.pdf');
    expect(p.abstract).toBe('We measured');
    expect(p.citationCounts?.[0]).toEqual({ source: 'openalex', count: 42 });
    expect(p.provenance?.[0]?.source).toBe('openalex');
  });

  it('normalizes authors incl. ORCID stripping + affiliation', () => {
    const p = mapOpenAlexWork(work)!;
    expect(p.authors).toHaveLength(2);
    expect(p.authors[0]).toMatchObject({ rawName: 'Jane Doe', orcid: '0000-0002-1825-0097', affiliation: 'MIT' });
    expect(p.authors[1]!.orcid).toBeUndefined();
  });

  it('maps book/preprint types and drops titleless works', () => {
    expect(mapOpenAlexWork({ ...work, type: 'book' })!.outputType).toBe('book');
    expect(mapOpenAlexWork({ ...work, type: 'preprint' })!.outputType).toBe('preprint');
    expect(mapOpenAlexWork({ id: 'x' })).toBeNull();
  });
});
