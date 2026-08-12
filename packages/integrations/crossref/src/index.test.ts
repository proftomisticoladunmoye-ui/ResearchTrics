import { describe, it, expect } from 'vitest';
import { mapCrossref } from './index';

const sample = {
  DOI: '10.1234/Example.2020',
  title: ['A Study of Measurement Invariance'],
  'container-title': ['Journal of Testing'],
  ISSN: ['1234-5678', '8765-4321'],
  volume: '12',
  issue: '3',
  page: '45-67',
  publisher: 'Test Press',
  type: 'journal-article',
  abstract: '<jats:p>An <b>abstract</b> with markup.</jats:p>',
  'is-referenced-by-count': 42,
  published: { 'date-parts': [[2020, 6, 15]] },
  license: [{ URL: 'https://creativecommons.org/licenses/by/4.0/' }],
  link: [{ 'content-type': 'application/pdf', URL: 'https://example.org/a.pdf' }],
  author: [
    { given: 'Ada', family: 'Lovelace', ORCID: 'https://orcid.org/0000-0002-1825-0097' },
    { given: 'Alan', family: 'Turing' },
  ],
};

describe('mapCrossref', () => {
  it('normalizes core metadata', () => {
    const p = mapCrossref(sample);
    expect(p.title).toBe('A Study of Measurement Invariance');
    expect(p.doi).toBe('10.1234/example.2020');
    expect(p.journalTitle).toBe('Journal of Testing');
    expect(p.issnPrint).toBe('1234-5678');
    expect(p.issnElectronic).toBe('8765-4321');
    expect(p.volume).toBe('12');
    expect(p.firstPage).toBe('45');
    expect(p.lastPage).toBe('67');
    expect(p.publishedYear).toBe(2020);
    expect(p.outputType).toBe('journal_article');
    expect(p.citationCount).toBe(42);
    expect(p.licenseCode).toBe('CC-BY');
    expect(p.pdfUrl).toBe('https://example.org/a.pdf');
  });

  it('strips markup from the abstract', () => {
    expect(mapCrossref(sample).abstract).toBe('An abstract with markup.');
  });

  it('maps authors with ORCID stripped to bare iD', () => {
    const p = mapCrossref(sample);
    expect(p.authors).toHaveLength(2);
    expect(p.authors[0]).toMatchObject({
      givenName: 'Ada',
      familyName: 'Lovelace',
      orcid: '0000-0002-1825-0097',
    });
  });

  it('is robust to a nearly-empty message', () => {
    const p = mapCrossref({});
    expect(p.title).toBe('(untitled)');
    expect(p.authors).toEqual([]);
  });
});
