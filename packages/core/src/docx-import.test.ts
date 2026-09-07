import { describe, it, expect } from 'vitest';
import { processImportedHtml } from './docx-import';

describe('processImportedHtml', () => {
  it('lifts the first heading as the title and removes it from the body', () => {
    const r = processImportedHtml('<h1>My Bulletin Title</h1><p>Intro paragraph.</p>');
    expect(r.title).toBe('My Bulletin Title');
    expect(r.bodyHtml).not.toContain('My Bulletin Title');
    expect(r.bodyHtml).toContain('Intro paragraph.');
    expect(r.report.titleDetected).toBe(true);
  });

  it('warns when no title heading is present', () => {
    const r = processImportedHtml('<p>Body only.</p>');
    expect(r.report.titleDetected).toBe(false);
    expect(r.report.warnings.some((w) => /title/i.test(w))).toBe(true);
  });

  it('does NOT lift a section heading like "Abstract" as the title', () => {
    const r = processImportedHtml('<h2>Abstract</h2><p>The abstract text.</p><h2>Introduction</h2><p>Body.</p>');
    expect(r.title).toBe('');
    expect(r.report.titleDetected).toBe(false);
    expect(r.report.warnings.some((w) => /section/i.test(w))).toBe(true);
    // Abstract is EXTRACTED into its own field, not left in the body.
    expect(r.abstract).toContain('The abstract text.');
    expect(r.bodyHtml).not.toContain('The abstract text.');
    expect(r.bodyHtml).toContain('Body.');
  });

  it('extracts authors + affiliation, abstract, keywords and references into fields', () => {
    const html = `
      <h1>A Study of Things</h1>
      <p>Jane Doe, John Smith</p>
      <p>Department of Testing, Example University</p>
      <h2>Abstract</h2><p>We studied things carefully.</p>
      <p>Keywords: testing, methods, rigor</p>
      <h2>Introduction</h2><p>Main content here.</p>
      <h2>References</h2><ol><li>Doe, J. (2025). A paper. https://doi.org/10.1234/abc</li><li>Smith, J. (2024). Another.</li></ol>`;
    const r = processImportedHtml(html);
    expect(r.title).toBe('A Study of Things');
    expect(r.authors.map((a) => a.name)).toEqual(['Jane Doe', 'John Smith']);
    expect(r.authors[0]!.affiliation).toContain('Example University');
    expect(r.abstract).toContain('We studied things');
    expect(r.keywords).toEqual(['testing', 'methods', 'rigor']);
    expect(r.references).toHaveLength(2);
    expect(r.references[0]!.doi).toBe('10.1234/abc');
    // Front matter is removed from the body; main content remains.
    expect(r.bodyHtml).toContain('Main content here.');
    expect(r.bodyHtml).not.toContain('We studied things');
    expect(r.bodyHtml).not.toContain('Jane Doe');
    expect(r.report.authorsDetected).toBe(2);
    expect(r.report.abstractDetected).toBe(true);
    expect(r.report.keywordsDetected).toBe(3);
  });

  it('does not swallow body prose as authors in an unstructured doc', () => {
    const r = processImportedHtml('<h1>Title</h1><p>This is a long opening paragraph of the article body that should remain in place.</p>');
    expect(r.authors).toEqual([]);
    expect(r.bodyHtml).toContain('long opening paragraph');
  });

  it('lifts a genuine title heading', () => {
    const r = processImportedHtml('<h1>Defining Research Visibility</h1><h2>Abstract</h2><p>…</p>');
    expect(r.title).toBe('Defining Research Visibility');
    expect(r.report.titleDetected).toBe(true);
  });

  it('converts a YouTube link into an embed iframe', () => {
    const r = processImportedHtml('<h2>T</h2><p><a href="https://www.youtube.com/watch?v=dQw4w9WgXcQ">video</a></p>');
    expect(r.report.youtube).toBe(1);
    expect(r.bodyHtml).toContain('https://www.youtube.com/embed/dQw4w9WgXcQ');
    expect(r.bodyHtml).toContain('<iframe');
  });

  it('strips scripts and disallowed markup via the sanitizer', () => {
    const r = processImportedHtml('<h2>T</h2><p>ok</p><script>alert(1)</script>');
    expect(r.bodyHtml).not.toContain('<script');
  });

  it('wraps a standalone image (with its caption) in a <figure>', () => {
    const r = processImportedHtml('<h2>T</h2><p><img src="https://cdn/x.png" alt="chart"></p><p>Figure 1. A chart.</p>');
    expect(r.bodyHtml).toContain('<figure>');
    expect(r.bodyHtml).toContain('<figcaption>Figure 1. A chart.</figcaption>');
    expect(r.bodyHtml).toContain('src="https://cdn/x.png"');
  });

  it('drops unconvertible (empty-src) images and reports them', () => {
    const r = processImportedHtml('<h2>T</h2><p>text</p><p><img src=""></p>', { imagesUnconvertible: 2 });
    expect(r.bodyHtml).not.toContain('<img');
    expect(r.report.imagesUnconvertible).toBe(2);
    expect(r.report.warnings.some((w) => /vector diagrams|EMF/i.test(w))).toBe(true);
  });

  it('counts headings, paragraphs, tables and references', () => {
    const html = `
      <h1>Title</h1>
      <h2>Introduction</h2><p>a</p><p>b</p>
      <h2>Methods</h2><p>c</p>
      <table><tr><td>x</td></tr></table>
      <h2>References</h2><ol><li>Ref one</li><li>Ref two</li></ol>`;
    const r = processImportedHtml(html);
    // References heading + list are extracted out; Introduction + Methods remain.
    expect(r.report.headings).toBe(2);
    expect(r.report.paragraphs).toBe(3);
    expect(r.report.tables).toBe(1);
    expect(r.report.references).toBe(2);
  });
});
