import { describe, it, expect } from 'vitest';
import { parseSearchParams } from './parse';
import { relevanceScore, normalizePaging } from './types';
import { InMemorySearchIndex, type IndexedDoc } from './in-memory';

describe('parseSearchParams', () => {
  it('parses query, types, filters and paging', () => {
    const q = parseSearchParams(
      new URLSearchParams('q=invariance&type=publication,researcher&yearFrom=2015&openAccess=true&page=2'),
    );
    expect(q.q).toBe('invariance');
    expect(q.filters?.types).toEqual(['publication', 'researcher']);
    expect(q.filters?.yearFrom).toBe(2015);
    expect(q.filters?.openAccess).toBe(true);
    expect(q.page).toBe(2);
  });

  it('ignores unknown types and missing values', () => {
    const q = parseSearchParams({ q: '  hello  ', type: 'bogus,journal' });
    expect(q.q).toBe('hello');
    expect(q.filters?.types).toEqual(['journal']);
  });
});

describe('relevanceScore', () => {
  it('ranks exact > prefix > word > substring', () => {
    expect(relevanceScore('Measurement', 'measurement')).toBe(1);
    expect(relevanceScore('Measurement Invariance', 'measure')).toBe(0.8);
    expect(relevanceScore('A study of measurement', 'measurement')).toBe(0.6);
    expect(relevanceScore('remeasurement', 'measurement')).toBe(0.4);
    expect(relevanceScore('unrelated', 'measurement')).toBe(0);
  });
});

describe('normalizePaging', () => {
  it('clamps page and size', () => {
    expect(normalizePaging(0, 0)).toEqual({ page: 1, pageSize: 1, skip: 0 });
    expect(normalizePaging(3, 20)).toEqual({ page: 3, pageSize: 20, skip: 40 });
    expect(normalizePaging(1, 999).pageSize).toBe(50);
  });
});

describe('InMemorySearchIndex', () => {
  const docs: IndexedDoc[] = [
    { type: 'publication', id: 'p1', title: 'Measurement Invariance', url: '/p/1', year: 2020, openAccess: true },
    { type: 'publication', id: 'p2', title: 'Unrelated topic', body: 'mentions measurement once', url: '/p/2', year: 2010 },
    { type: 'researcher', id: 'r1', title: 'Ada Measurement', url: '/r/1', verified: true },
    { type: 'institution', id: 'i1', title: 'Measurement University', url: '/i/1', country: 'KE' },
  ];
  const index = new InMemorySearchIndex(docs);

  it('ranks and returns matches with facets', async () => {
    const res = await index.search({ q: 'measurement' });
    expect(res.items[0]?.title).toBe('Measurement Invariance');
    expect(res.total).toBe(4);
    expect(res.facets.types.publication).toBe(2);
    expect(res.facets.types.researcher).toBe(1);
  });

  it('applies type + openAccess + year filters', async () => {
    const res = await index.search({ q: 'measurement', filters: { types: ['publication'], openAccess: true } });
    expect(res.items).toHaveLength(1);
    expect(res.items[0]?.id).toBe('p1');
  });

  it('supports empty-query browse', async () => {
    const res = await index.search({ q: '', filters: { types: ['institution'] } });
    expect(res.items).toHaveLength(1);
  });
});
