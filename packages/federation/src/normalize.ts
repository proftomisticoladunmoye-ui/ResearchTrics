import type { NormalizedPublication } from '@researchtrics/integration-shared';
import type { NormalizedWork } from './types';

/**
 * Map an adapter's `NormalizedPublication` (Crossref/OpenAlex) into the
 * federation `NormalizedWork` — a resource-type-aware view carrying external
 * IDs and provenance (addendum §16). Pure + tested. Citation counts stay
 * source-specific and are never merged here (§30).
 */
export function toNormalizedWork(pub: NormalizedPublication, providerName: string): NormalizedWork {
  const retrievedAt = new Date().toISOString();
  const sourceUrl = pub.doi ? `https://doi.org/${pub.doi}` : undefined;

  return {
    source: providerName,
    resourceType: 'publication',
    title: pub.title,
    abstract: pub.abstract,
    publishedYear: pub.publishedYear,
    publishedOn: pub.publishedOn,
    journalTitle: pub.journalTitle,
    publisher: pub.publisher,
    licenseCode: pub.licenseCode,
    externalIds: {
      doi: pub.doi,
      openalex: pub.openAlexId,
    },
    authors: pub.authors.map((a) => ({
      rawName: a.rawName,
      orcid: a.orcid,
      affiliation: a.affiliation,
    })),
    citationCount: pub.citationCount,
    provenance: {
      source: providerName,
      sourceId: pub.doi,
      sourceUrl,
      retrievedAt,
    },
    raw: pub.raw,
  };
}
