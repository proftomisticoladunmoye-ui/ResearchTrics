import { describe, it, expect } from 'vitest';
import { checkGoogleScholarCompliance, type ScholarInput } from './scholar-compliance';

const complete: ScholarInput = {
  title: 'A Complete Paper',
  authorCount: 2,
  publicationDate: '2020-06-15',
  journalTitle: 'Journal of Testing',
  issn: '1234-5678',
  volume: '12',
  issue: '3',
  firstPage: '45',
  lastPage: '67',
  doi: '10.1/abc',
  abstract: 'An abstract.',
  pdfUrl: 'https://example.org/a.pdf',
  isPublic: true,
  hostedPdf: { hasText: true, sizeBytes: 1_000_000 },
};

describe('checkGoogleScholarCompliance', () => {
  it('passes overall for a complete, public, text-PDF publication', () => {
    const r = checkGoogleScholarCompliance(complete);
    expect(r.overall).toBe('pass');
    expect(r.summary.fail).toBe(0);
    expect(r.summary.warning).toBe(0);
  });

  it('fails when the publication is not public', () => {
    const r = checkGoogleScholarCompliance({ ...complete, isPublic: false });
    expect(r.overall).toBe('fail');
    expect(r.checks.find((c) => c.key === 'crawlability')?.status).toBe('fail');
    expect(r.checks.find((c) => c.key === 'abstract_visibility')?.status).toBe('fail');
  });

  it('fails when title or authors are missing', () => {
    const r = checkGoogleScholarCompliance({ ...complete, title: '', authorCount: 0 });
    expect(r.overall).toBe('fail');
    expect(r.checks.find((c) => c.key === 'citation_title')?.status).toBe('fail');
    expect(r.checks.find((c) => c.key === 'citation_author')?.status).toBe('fail');
  });

  it('flags an image-only hosted PDF as fail', () => {
    const r = checkGoogleScholarCompliance({
      ...complete,
      hostedPdf: { hasText: false, sizeBytes: 500_000 },
    });
    expect(r.checks.find((c) => c.key === 'pdf_text_extractable')?.status).toBe('fail');
  });

  it('warns (not fails) on missing optional metadata', () => {
    const r = checkGoogleScholarCompliance({
      ...complete,
      issn: null,
      volume: null,
      issue: null,
      hostedPdf: null,
    });
    expect(r.overall).toBe('warning');
    expect(r.summary.warning).toBeGreaterThan(0);
    expect(r.summary.fail).toBe(0);
  });
});
