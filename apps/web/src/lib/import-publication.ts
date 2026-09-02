import {
  assertValidDoi,
  findPublicationByDoi,
  createPublicationFromNormalized,
  linkResearcherToPublication,
  restorePublication,
  logger,
  type CreatePublicationInput,
} from '@researchtrics/core';
import { fetchByDoi as crossrefByDoi } from '@researchtrics/integration-crossref';
import { fetchByDoi as openAlexByDoi } from '@researchtrics/integration-openalex';
import type { NormalizedPublication } from '@researchtrics/integration-shared';

/**
 * DOI import orchestrator (Spec §56, §85). Crossref is the authoritative source
 * for metadata; OpenAlex enriches (citations, abstract fallback). Lives in the
 * app layer to keep core free of integration dependencies.
 */
export async function importPublicationByDoi(
  doiInput: string,
  linkResearcher?: { id: string; displayName: string; orcid?: string | undefined },
): Promise<{ status: 'created' | 'exists'; slug: string }> {
  const doi = assertValidDoi(doiInput);

  const existing = await findPublicationByDoi(doi);
  if (existing) {
    // A previously-removed work being re-imported: restore it so the page loads
    // instead of 404-ing on a soft-deleted slug.
    if (existing.deletedAt) await restorePublication(existing.id);
    // Already in the graph — still associate the importing researcher with it.
    if (linkResearcher) await linkResearcherToPublication(existing.id, linkResearcher);
    return { status: 'exists', slug: existing.slug };
  }

  // Crossref is authoritative; failure here is fatal (we cannot invent metadata).
  const crossref = await crossrefByDoi(doi);

  // OpenAlex enrichment is best-effort.
  let openalex: NormalizedPublication | null = null;
  try {
    openalex = await openAlexByDoi(doi);
  } catch (err) {
    logger.warn({ err, doi }, 'OpenAlex enrichment failed (continuing with Crossref only)');
  }

  const input = mergeSources(doi, crossref, openalex);
  const result = await createPublicationFromNormalized(input);
  // Link the importing researcher so it appears under "My publications" (§15).
  if (linkResearcher) await linkResearcherToPublication(result.publicationId, linkResearcher);
  return { status: result.status, slug: result.slug };
}

function mergeSources(
  doi: string,
  crossref: NormalizedPublication,
  openalex: NormalizedPublication | null,
): CreatePublicationInput {
  const citationCounts: CreatePublicationInput['citationCounts'] = [];
  if (typeof crossref.citationCount === 'number')
    citationCounts.push({ source: 'crossref', count: crossref.citationCount });
  if (openalex && typeof openalex.citationCount === 'number')
    citationCounts.push({ source: 'openalex', count: openalex.citationCount });

  const provenance: CreatePublicationInput['provenance'] = [
    { source: 'crossref', sourceId: doi, sourceUrl: `https://doi.org/${doi}`, raw: crossref.raw },
  ];
  if (openalex) {
    provenance.push({
      source: 'openalex',
      sourceId: openalex.openAlexId ?? doi,
      sourceUrl: openalex.openAlexId ? `https://openalex.org/${openalex.openAlexId}` : undefined,
      raw: openalex.raw,
    });
  }

  const pdfUrl = crossref.pdfUrl ?? openalex?.pdfUrl;
  const openAccess = Boolean(crossref.licenseCode?.startsWith('CC') || openalex?.pdfUrl);

  return {
    title: crossref.title,
    abstract: crossref.abstract ?? openalex?.abstract,
    doi,
    outputType: crossref.outputType ?? openalex?.outputType,
    journalTitle: crossref.journalTitle ?? openalex?.journalTitle,
    issnPrint: crossref.issnPrint ?? openalex?.issnPrint,
    issnElectronic: crossref.issnElectronic,
    volume: crossref.volume ?? openalex?.volume,
    issue: crossref.issue ?? openalex?.issue,
    firstPage: crossref.firstPage ?? openalex?.firstPage,
    lastPage: crossref.lastPage ?? openalex?.lastPage,
    publishedYear: crossref.publishedYear ?? openalex?.publishedYear,
    publishedOn: crossref.publishedOn ?? openalex?.publishedOn,
    publisher: crossref.publisher,
    licenseCode: crossref.licenseCode,
    openAccess,
    pdfUrl,
    openAlexId: openalex?.openAlexId,
    authors: (crossref.authors.length > 0 ? crossref.authors : (openalex?.authors ?? [])).map((a) => ({
      rawName: a.rawName,
      givenName: a.givenName,
      familyName: a.familyName,
      orcid: a.orcid,
      affiliation: a.affiliation,
      isCorresponding: a.isCorresponding,
    })),
    citationCounts,
    provenance,
  };
}
