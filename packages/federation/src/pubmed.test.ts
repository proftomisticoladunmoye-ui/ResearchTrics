import { describe, it, expect } from 'vitest';
import { mapPubMedSummary, PubMedMetadataProvider } from './index';

const SUMMARY = {
  uid: '12345678',
  title: 'Resilience and coping in clinical populations',
  fulljournalname: 'Journal of Health Psychology',
  pubdate: '2021 Mar',
  authors: [
    { name: 'Lovelace A', authtype: 'Author' },
    { name: 'Turing A', authtype: 'Author' },
  ],
  articleids: [
    { idtype: 'pubmed', value: '12345678' },
    { idtype: 'doi', value: '10.1000/health.1' },
    { idtype: 'pmc', value: 'PMC7654321' },
  ],
  pubtype: ['Journal Article', 'Review'],
};

describe('mapPubMedSummary (§6, §7)', () => {
  it('maps a PubMed summary with PMID/DOI/PMCID + pubtypes + provenance', () => {
    const w = mapPubMedSummary(SUMMARY);
    expect(w.source).toBe('pubmed');
    expect(w.resourceType).toBe('publication');
    expect(w.title).toContain('Resilience');
    expect(w.externalIds.pmid).toBe('12345678');
    expect(w.externalIds.doi).toBe('10.1000/health.1');
    expect(w.externalIds.pmcid).toBe('PMC7654321');
    expect(w.publishedYear).toBe(2021);
    expect(w.publicationTypes).toContain('Review');
    expect(w.provenance.sourceUrl).toBe('https://pubmed.ncbi.nlm.nih.gov/12345678/');
  });

  it('handles a record without a DOI (§6: not every record has one)', () => {
    const w = mapPubMedSummary({ uid: '999', title: 'No DOI here', articleids: [{ idtype: 'pubmed', value: '999' }] });
    expect(w.externalIds.pmid).toBe('999');
    expect(w.externalIds.doi).toBeUndefined();
  });
});

/** URL-aware stub: esearch returns id list, esummary returns the record. */
function ncbiStub(): typeof fetch {
  return (async (url: string) => {
    const body = url.includes('esearch.fcgi')
      ? { esearchresult: { idlist: ['12345678'] } }
      : { result: { uids: ['12345678'], '12345678': SUMMARY } };
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as unknown as typeof fetch;
}

describe('PubMedMetadataProvider (offline)', () => {
  it('searchWorks by author name runs esearch → esummary', async () => {
    const p = new PubMedMetadataProvider({ tool: 'researchtrics', email: 'ops@x.test' }, ncbiStub());
    const works = await p.searchWorks({ name: 'Ada Lovelace' });
    expect(works).toHaveLength(1);
    expect(works[0]!.externalIds.pmid).toBe('12345678');
  });

  it('returns nothing when there is no name to search on', async () => {
    const p = new PubMedMetadataProvider({}, ncbiStub());
    expect(await p.searchWorks({})).toEqual([]);
  });

  it('getWork by PMID returns a normalized record', async () => {
    const p = new PubMedMetadataProvider({}, ncbiStub());
    const w = await p.getWork({ pmid: '12345678' });
    expect(w.title).toContain('Resilience');
    expect(p.capabilities).toContain('search');
  });
});
