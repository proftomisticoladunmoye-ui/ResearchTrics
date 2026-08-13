import { describe, it, expect } from 'vitest';
import { resolveField, resolveWork } from './unification';
import type { NormalizedWork } from '@researchtrics/federation';

function work(source: string, over: Partial<NormalizedWork>): NormalizedWork {
  return {
    source,
    resourceType: 'publication',
    title: 'A study',
    externalIds: {},
    authors: [],
    provenance: { source, retrievedAt: new Date().toISOString() },
    ...over,
  };
}

describe('resolveField (conflict resolution, §19)', () => {
  it('returns none/null for no values', () => {
    const r = resolveField('title', [{ source: 'crossref', value: null }]);
    expect(r.value).toBeNull();
    expect(r.conflictStatus).toBe('none');
  });

  it('marks a single agreed value', () => {
    const r = resolveField('title', [
      { source: 'crossref', value: 'Same' },
      { source: 'openalex', value: 'Same' },
    ]);
    expect(r.conflictStatus).toBe('single');
    expect(r.value).toBe('Same');
  });

  it('detects a conflict and chooses by source priority', () => {
    const r = resolveField('publishedYear', [
      { source: 'openalex', value: '2025-05-02' },
      { source: 'crossref', value: '2025-05-01' },
      { source: 'ojs', value: '2025-05-03' },
    ]);
    expect(r.conflictStatus).toBe('conflict');
    // publishedYear priority: ojs first
    expect(r.source).toBe('ojs');
    expect(r.value).toBe('2025-05-03');
    expect(r.candidates).toHaveLength(3); // all values retained
  });

  it('falls back to the first present value when no priority source matches', () => {
    const r = resolveField('title', [{ source: 'weird', value: 'Only' }]);
    expect(r.value).toBe('Only');
    expect(r.source).toBe('weird');
  });
});

describe('resolveWork (§16, §18)', () => {
  const candidates: NormalizedWork[] = [
    work('crossref', {
      title: 'Measurement invariance',
      publisher: 'Elsevier',
      publishedYear: 2020,
      externalIds: { doi: '10.1/x', crossref: '10.1/x' },
      authors: [{ rawName: 'Ada Lovelace' }],
    }),
    work('openalex', {
      title: 'Measurement invariance',
      publishedYear: 2021, // conflict with crossref
      externalIds: { doi: '10.1/x', openalex: 'W1' },
      authors: [{ rawName: 'Ada Lovelace' }, { rawName: 'Alan Turing' }],
    }),
    work('datacite', { title: 'Measurement invariance', publisher: 'DataCite Inc', externalIds: { doi: '10.1/x', datacite: '10.1/x' }, authors: [] }),
  ];

  it('unions external IDs across sources', () => {
    const r = resolveWork(candidates);
    expect(r.externalIds.doi).toBe('10.1/x');
    expect(r.externalIds.openalex).toBe('W1');
    expect(r.externalIds.datacite).toBe('10.1/x');
  });

  it('resolves a publishedYear conflict and records it', () => {
    const r = resolveWork(candidates);
    expect(r.fields.publishedYear!.conflictStatus).toBe('conflict');
    // priority puts crossref above openalex for the year
    expect(r.fields.publishedYear!.value).toBe('2020');
  });

  it('resolves publisher by priority (datacite over crossref)', () => {
    const r = resolveWork(candidates);
    expect(r.fields.publisher!.source).toBe('datacite');
    expect(r.fields.publisher!.value).toBe('DataCite Inc');
  });

  it('picks authors from the highest-priority source that has them', () => {
    const r = resolveWork(candidates);
    expect(r.authors.length).toBeGreaterThan(0); // crossref has authors and is top priority
  });

  it('raises confidence with more sources', () => {
    const one = resolveWork([candidates[0]!]);
    const three = resolveWork(candidates);
    expect(three.confidence).toBeGreaterThan(one.confidence);
    expect(three.confidence).toBeLessThanOrEqual(1);
  });
});
