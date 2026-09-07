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
    const r = processImportedHtml('<h2>Abstract</h2><p>The abstract text.</p><h2>Introduction</h2><p>…</p>');
    expect(r.title).toBe('');
    expect(r.report.titleDetected).toBe(false);
    expect(r.report.warnings.some((w) => /section/i.test(w))).toBe(true);
    // The Abstract heading stays in the body (not consumed as a title).
    expect(r.bodyHtml).toContain('Abstract');
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
    expect(r.report.headings).toBe(3); // Introduction, Methods, References (h1 lifted out)
    expect(r.report.paragraphs).toBe(3);
    expect(r.report.tables).toBe(1);
    expect(r.report.references).toBe(2);
  });
});
