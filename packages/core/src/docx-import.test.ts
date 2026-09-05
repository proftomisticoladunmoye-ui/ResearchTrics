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
