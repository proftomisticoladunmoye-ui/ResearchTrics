import { XMLParser } from 'fast-xml-parser';
import type { NormalizedPublication, NormalizedAuthor } from '@researchtrics/integration-shared';

/**
 * OAI-PMH client + Dublin Core mapper (Spec §12). OAI-PMH is standardized and
 * present on essentially all OJS installs, making it the reliable, version-
 * agnostic harvest path. Parsing/mapping is pure and unit-tested; network is
 * injectable.
 */

const parser = new XMLParser({
  ignoreAttributes: true,
  removeNSPrefix: true,
  trimValues: true,
  // Keep scholarly values as strings (versions, ISSNs, dates, DOIs).
  parseTagValue: false,
});

function toArray<T>(v: T | T[] | undefined | null): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

function asString(v: unknown): string | undefined {
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  return undefined;
}

async function fetchOaiXml(url: string, fetchImpl: typeof fetch): Promise<string> {
  const res = await fetchImpl(url, {
    headers: { accept: 'application/xml,text/xml', 'user-agent': 'ResearchTrics/1.0 (+https://researchtrics.local)' },
  });
  if (!res.ok) throw new Error(`OAI request failed (${res.status}) for ${url}`);
  return res.text();
}

export interface OaiIdentify {
  repositoryName?: string;
  protocolVersion?: string;
  detectedVersion?: string; // best-effort OJS version
}

export async function oaiIdentify(oaiUrl: string, fetchImpl: typeof fetch = fetch): Promise<OaiIdentify> {
  const xml = await fetchOaiXml(`${oaiUrl}?verb=Identify`, fetchImpl);
  return parseIdentify(xml);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function parseIdentify(xml: string): OaiIdentify {
  const root = parser.parse(xml) as any;
  const id = root?.['OAI-PMH']?.Identify ?? {};
  const result: OaiIdentify = {};
  if (asString(id.repositoryName)) result.repositoryName = asString(id.repositoryName);
  if (asString(id.protocolVersion)) result.protocolVersion = asString(id.protocolVersion);
  // Best-effort OJS version detection from any embedded toolkit string.
  const m = xml.match(/Open Journal Systems[^\d]*(\d+\.\d+\.\d+(?:\.\d+)?)/i) ?? xml.match(/OJS[^\d]*(\d+\.\d+\.\d+(?:\.\d+)?)/i);
  if (m?.[1]) result.detectedVersion = m[1];
  return result;
}

export interface OaiSet {
  spec: string;
  name?: string;
}

export function parseListSets(xml: string): OaiSet[] {
  const root = parser.parse(xml) as any;
  const sets = toArray(root?.['OAI-PMH']?.ListSets?.set);
  return sets
    .map((s: any): OaiSet | null => {
      const spec = asString(s?.setSpec);
      if (!spec) return null;
      const set: OaiSet = { spec };
      const name = asString(s?.setName);
      if (name) set.name = name;
      return set;
    })
    .filter((s): s is OaiSet => s !== null);
}

export async function oaiListSets(oaiUrl: string, fetchImpl: typeof fetch = fetch): Promise<OaiSet[]> {
  const xml = await fetchOaiXml(`${oaiUrl}?verb=ListSets`, fetchImpl);
  return parseListSets(xml);
}

export interface OaiRecord {
  identifier: string;
  datestamp?: string;
  setSpecs: string[];
  deleted: boolean;
  dc?: Record<string, unknown>;
}

export interface ListRecordsPage {
  records: OaiRecord[];
  resumptionToken?: string;
}

export function parseListRecords(xml: string): ListRecordsPage {
  const root = parser.parse(xml) as any;
  const lr = root?.['OAI-PMH']?.ListRecords ?? {};
  const records = toArray(lr.record).map((r: any): OaiRecord => {
    const header = r?.header ?? {};
    const deleted = asString(header?.['@_status']) === 'deleted';
    const rec: OaiRecord = {
      identifier: asString(header?.identifier) ?? '',
      setSpecs: toArray(header?.setSpec).map(asString).filter((s): s is string => !!s),
      deleted,
    };
    const ds = asString(header?.datestamp);
    if (ds) rec.datestamp = ds;
    const dc = r?.metadata?.dc;
    if (dc && typeof dc === 'object') rec.dc = dc as Record<string, unknown>;
    return rec;
  });
  const page: ListRecordsPage = { records };
  const token = asString(lr.resumptionToken);
  if (token) page.resumptionToken = token;
  return page;
}

export async function oaiListRecords(
  oaiUrl: string,
  options: { set?: string; resumptionToken?: string } = {},
  fetchImpl: typeof fetch = fetch,
): Promise<ListRecordsPage> {
  const params = new URLSearchParams({ verb: 'ListRecords' });
  if (options.resumptionToken) {
    params.set('resumptionToken', options.resumptionToken);
  } else {
    params.set('metadataPrefix', 'oai_dc');
    if (options.set) params.set('set', options.set);
  }
  const xml = await fetchOaiXml(`${oaiUrl}?${params.toString()}`, fetchImpl);
  return parseListRecords(xml);
}

const DOI_RE = /\b10\.\d{4,9}\/[^\s"']+/;

/** Map an OAI Dublin Core record into the normalized publication shape. Pure. */
export function mapOaiDcRecord(record: OaiRecord): NormalizedPublication {
  const dc = record.dc ?? {};
  const title = toArray((dc as any).title).map(asString).find(Boolean) ?? '(untitled)';
  const creators = toArray((dc as any).creator).map(asString).filter((s): s is string => !!s);
  const identifiers = toArray((dc as any).identifier).map(asString).filter((s): s is string => !!s);
  const description = toArray((dc as any).description).map(asString).find(Boolean);
  const dateStr = toArray((dc as any).date).map(asString).find(Boolean);
  const source = toArray((dc as any).source).map(asString).find(Boolean);
  const publisher = toArray((dc as any).publisher).map(asString).find(Boolean);
  const type = toArray((dc as any).type).map(asString).find(Boolean);

  const doi =
    identifiers.map((i) => i.match(DOI_RE)?.[0]).find(Boolean) ??
    undefined;
  const url = identifiers.find((i) => /^https?:\/\//i.test(i));

  const pub: NormalizedPublication = {
    source: 'ojs',
    title,
    authors: creators.map((c): NormalizedAuthor => parseCreator(c)),
    raw: record,
  };
  if (doi) pub.doi = doi.toLowerCase();
  if (description) pub.abstract = description;
  if (publisher) pub.publisher = publisher;
  if (type) pub.outputType = mapType(type);
  if (url && /\.pdf($|\?)/i.test(url)) pub.pdfUrl = url;

  // dc:source often holds "Journal Name; Vol(Issue)" and/or an ISSN.
  if (source) {
    const issn = source.match(/\b\d{4}-\d{3}[\dxX]\b/)?.[0];
    if (issn) pub.issnElectronic = issn;
    const journalTitle = source.split(';')[0]?.replace(/\b\d{4}-\d{3}[\dxX]\b/, '').trim();
    if (journalTitle) pub.journalTitle = journalTitle;
  }

  if (dateStr) {
    pub.publishedOn = dateStr.length >= 10 ? new Date(dateStr).toISOString() : undefined;
    const year = parseInt(dateStr.slice(0, 4), 10);
    if (!Number.isNaN(year)) pub.publishedYear = year;
  }

  return pub;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function parseCreator(creator: string): NormalizedAuthor {
  // OAI DC creators are usually "Family, Given".
  const [family, given] = creator.split(',').map((s) => s.trim());
  const author: NormalizedAuthor = { rawName: creator };
  if (given && family) {
    author.familyName = family;
    author.givenName = given;
  } else {
    const parts = creator.trim().split(/\s+/);
    if (parts.length > 1) {
      author.familyName = parts[parts.length - 1];
      author.givenName = parts.slice(0, -1).join(' ');
    }
  }
  return author;
}

function mapType(type: string): string {
  const t = type.toLowerCase();
  if (t.includes('article')) return 'journal_article';
  if (t.includes('review')) return 'journal_article';
  return 'other';
}
