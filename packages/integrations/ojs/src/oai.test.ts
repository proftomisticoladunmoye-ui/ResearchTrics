import { describe, it, expect } from 'vitest';
import { parseIdentify, parseListSets, parseListRecords, mapOaiDcRecord } from './oai';

const IDENTIFY = `<?xml version="1.0"?>
<OAI-PMH xmlns="http://www.openarchives.org/OAI/2.0/">
  <Identify>
    <repositoryName>Demo Journal</repositoryName>
    <protocolVersion>2.0</protocolVersion>
    <description>Powered by Open Journal Systems 3.4.0.8</description>
  </Identify>
</OAI-PMH>`;

const LISTSETS = `<?xml version="1.0"?>
<OAI-PMH xmlns="http://www.openarchives.org/OAI/2.0/">
  <ListSets>
    <set><setSpec>demojournal</setSpec><setName>Demo Journal</setName></set>
    <set><setSpec>other</setSpec><setName>Other</setName></set>
  </ListSets>
</OAI-PMH>`;

const LISTRECORDS = `<?xml version="1.0"?>
<OAI-PMH xmlns="http://www.openarchives.org/OAI/2.0/">
  <ListRecords>
    <record>
      <header>
        <identifier>oai:demo:article/42</identifier>
        <datestamp>2020-06-15</datestamp>
        <setSpec>demojournal</setSpec>
      </header>
      <metadata>
        <oai_dc:dc xmlns:oai_dc="http://www.openarchives.org/OAI/2.0/oai_dc/" xmlns:dc="http://purl.org/dc/elements/1.1/">
          <dc:title>Measurement Invariance in Practice</dc:title>
          <dc:creator>Lovelace, Ada</dc:creator>
          <dc:creator>Turing, Alan</dc:creator>
          <dc:description>An abstract about invariance.</dc:description>
          <dc:publisher>Demo Press</dc:publisher>
          <dc:date>2020-06-15</dc:date>
          <dc:type>Peer-reviewed Article</dc:type>
          <dc:identifier>https://doi.org/10.1234/demo.42</dc:identifier>
          <dc:identifier>https://demo.org/article/42</dc:identifier>
          <dc:source>Demo Journal; 2515-8260</dc:source>
        </oai_dc:dc>
      </metadata>
    </record>
    <resumptionToken>TOKEN123</resumptionToken>
  </ListRecords>
</OAI-PMH>`;

describe('parseIdentify', () => {
  it('extracts repository name and detects the OJS version', () => {
    const id = parseIdentify(IDENTIFY);
    expect(id.repositoryName).toBe('Demo Journal');
    expect(id.protocolVersion).toBe('2.0');
    expect(id.detectedVersion).toBe('3.4.0.8');
  });
});

describe('parseListSets', () => {
  it('returns journal sets', () => {
    const sets = parseListSets(LISTSETS);
    expect(sets).toHaveLength(2);
    expect(sets[0]).toEqual({ spec: 'demojournal', name: 'Demo Journal' });
  });
});

describe('parseListRecords + mapOaiDcRecord', () => {
  it('parses records and a resumption token', () => {
    const page = parseListRecords(LISTRECORDS);
    expect(page.records).toHaveLength(1);
    expect(page.resumptionToken).toBe('TOKEN123');
    expect(page.records[0]?.identifier).toBe('oai:demo:article/42');
  });

  it('maps Dublin Core into a normalized publication', () => {
    const page = parseListRecords(LISTRECORDS);
    const pub = mapOaiDcRecord(page.records[0]!);
    expect(pub.source).toBe('ojs');
    expect(pub.title).toBe('Measurement Invariance in Practice');
    expect(pub.doi).toBe('10.1234/demo.42');
    expect(pub.abstract).toBe('An abstract about invariance.');
    expect(pub.publisher).toBe('Demo Press');
    expect(pub.publishedYear).toBe(2020);
    expect(pub.journalTitle).toBe('Demo Journal');
    expect(pub.issnElectronic).toBe('2515-8260');
    expect(pub.authors.map((a) => a.familyName)).toEqual(['Lovelace', 'Turing']);
  });
});
