import { describe, it, expect } from 'vitest';
import { formatCitation, toBibTeX, toRIS, toAPA, type CitationData } from './citation-export';

const data: CitationData = {
  title: 'Measurement Invariance in Cross-Cultural Research',
  authors: [
    { given: 'Ada', family: 'Lovelace' },
    { given: 'Alan', family: 'Turing' },
  ],
  year: 2020,
  journalTitle: 'Journal of Testing',
  volume: '12',
  issue: '3',
  firstPage: '45',
  lastPage: '67',
  doi: '10.1234/example.2020',
};

describe('citation exports', () => {
  it('BibTeX includes key fields', () => {
    const bib = toBibTeX(data);
    expect(bib).toContain('@article{lovelace2020');
    expect(bib).toContain('author = {Ada Lovelace and Alan Turing}');
    expect(bib).toContain('doi = {10.1234/example.2020}');
    expect(bib).toContain('pages = {45-67}');
  });

  it('RIS is well-formed', () => {
    const ris = toRIS(data);
    expect(ris.startsWith('TY  - JOUR')).toBe(true);
    expect(ris).toContain('AU  - Lovelace, Ada');
    expect(ris).toContain('SP  - 45');
    expect(ris.trimEnd().endsWith('ER  -')).toBe(true);
  });

  it('APA formats authors, year, source and DOI', () => {
    const apa = toAPA(data);
    expect(apa).toContain('Lovelace, A., & Turing, A.');
    expect(apa).toContain('(2020).');
    expect(apa).toContain('Journal of Testing, 12(3), 45-67.');
    expect(apa).toContain('https://doi.org/10.1234/example.2020');
  });

  it('dispatches by format', () => {
    expect(formatCitation(data, 'bibtex')).toBe(toBibTeX(data));
    expect(formatCitation(data, 'vancouver')).toContain('Lovelace A, Turing A');
  });
});
