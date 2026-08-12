import type { NormalizedPublication } from '@researchtrics/integration-shared';
import { oaiListRecords } from './oai';
import { mapOaiDcRecord } from './oai';

/**
 * Harvest strategies (Spec §12). OAI-PMH is the reliable default; a native REST
 * strategy is scaffolded behind the capability probe and must be verified in the
 * target environment before use.
 */

export interface HarvestedArticle {
  /** Stable OJS-side identifier used for idempotent mapping (OAI header id). */
  ojsArticleId: string;
  setSpecs: string[];
  deleted: boolean;
  publication: NormalizedPublication;
}

/**
 * Stream all articles from an OJS OAI-PMH endpoint, following resumption
 * tokens. Yields one item per record.
 */
export async function* harvestOai(
  oaiUrl: string,
  options: { set?: string; maxPages?: number } = {},
  fetchImpl: typeof fetch = fetch,
): AsyncGenerator<HarvestedArticle> {
  let resumptionToken: string | undefined;
  let pages = 0;
  const maxPages = options.maxPages ?? 1000;

  do {
    const page: Awaited<ReturnType<typeof oaiListRecords>> = await oaiListRecords(
      oaiUrl,
      resumptionToken ? { resumptionToken } : options.set ? { set: options.set } : {},
      fetchImpl,
    );
    for (const record of page.records) {
      yield {
        ojsArticleId: record.identifier,
        setSpecs: record.setSpecs,
        deleted: record.deleted,
        publication: mapOaiDcRecord(record),
      };
    }
    resumptionToken = page.resumptionToken;
    pages += 1;
  } while (resumptionToken && pages < maxPages);
}

/**
 * Native REST harvest — SCAFFOLD ONLY (Spec §12, §93). OJS REST endpoints and
 * auth vary by major version; this must be implemented and verified against the
 * detected install (see `probeOjs`). Until then, sync uses OAI-PMH.
 */
// Intentionally throw-only until REST is implemented; keep the generator shape.
// eslint-disable-next-line require-yield
export async function* harvestRest(): AsyncGenerator<HarvestedArticle> {
  throw new Error(
    'OJS native REST harvest is not implemented yet. The capability probe defaults to OAI-PMH; ' +
      'implement and verify REST endpoints against the detected OJS version before enabling.',
  );
}
