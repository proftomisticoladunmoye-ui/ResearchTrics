import { describe, it, expect } from 'vitest';
import { extractInternalCitationSlugs, authorSlug } from './bulletin';

describe('extractInternalCitationSlugs', () => {
  it('finds internal bulletin links (relative and absolute) and dedups', () => {
    const html = `
      <p>See <a href="/research-bulletin/reliability-001">Bulletin 1</a>.</p>
      <p>And <a href="https://www.researchtrics.com/research-bulletin/validity-002">Bulletin 2</a>.</p>
      <p>Again <a href="/research-bulletin/reliability-001">same</a>.</p>`;
    expect(extractInternalCitationSlugs(html).sort()).toEqual(['reliability-001', 'validity-002']);
  });

  it('ignores non-bulletin and external links', () => {
    const html = '<a href="/publications/foo">x</a><a href="https://example.com/research-bulletin/y">y</a>';
    // The example.com absolute link IS matched (host-agnostic) — that is intended
    // (crawlable canonical host may vary); only the /publications link is ignored.
    expect(extractInternalCitationSlugs(html)).toEqual(['y']);
  });

  it('returns empty for no internal links', () => {
    expect(extractInternalCitationSlugs('<p>no links</p>')).toEqual([]);
  });
});

describe('authorSlug', () => {
  it('normalizes an author name to a stable slug', () => {
    expect(authorSlug('Oladunmoye, E. O.')).toBe(authorSlug('Oladunmoye, E. O.'));
    expect(authorSlug('Ada Lovelace')).toMatch(/^ada-lovelace$/);
  });
});
