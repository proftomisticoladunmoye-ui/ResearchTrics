import { prisma, type PrismaClient } from '@researchtrics/db';
import { fetchOpenAlexCitationCounts, type OpenAlexWorksOptions } from './openalex-works';
import { logger } from './logger';

/**
 * Periodic citation-count refresh (Spec §33). Citation counts are captured when
 * a work is first imported, but they keep growing in the scholarly graph. This
 * re-pulls current `cited_by_count` from OpenAlex for known works whose stored
 * count is missing or stale, so on-platform citation totals stay live rather
 * than frozen at import time. Idempotent and bounded per run.
 */

export interface RefreshCitationsResult {
  /** Works considered (had an OpenAlex id and a stale/absent count). */
  checked: number;
  /** Counts written (new or changed). */
  updated: number;
  /** Works whose count was already current. */
  unchanged: number;
}

export interface RefreshCitationsOptions extends OpenAlexWorksOptions {
  /** Max works to refresh in one run (bounds API + DB work). */
  limit?: number;
  /** Refresh a work only if its OpenAlex count is older than this. */
  staleAfterDays?: number;
}

export async function refreshCitationCounts(
  opts: RefreshCitationsOptions = {},
  client: PrismaClient = prisma,
): Promise<RefreshCitationsResult> {
  const limit = Math.min(opts.limit ?? 200, 500);
  const staleAfterDays = opts.staleAfterDays ?? 7;
  const cutoff = new Date(Date.now() - staleAfterDays * 86_400_000);

  // Candidates: works with an OpenAlex id whose OpenAlex citation count is
  // missing or older than the cutoff.
  const candidates = await client.publicationIdentifier.findMany({
    where: {
      scheme: 'openalex',
      publication: {
        deletedAt: null,
        citationCounts: { none: { source: 'openalex', asOf: { gte: cutoff } } },
      },
    },
    select: { value: true, publicationId: true },
    take: limit,
  });
  if (candidates.length === 0) return { checked: 0, updated: 0, unchanged: 0 };

  const byOpenAlexId = new Map(candidates.map((c) => [c.value, c.publicationId]));
  let counts: Map<string, number>;
  try {
    counts = await fetchOpenAlexCitationCounts([...byOpenAlexId.keys()], opts);
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'Citation refresh: OpenAlex fetch failed');
    return { checked: candidates.length, updated: 0, unchanged: 0 };
  }

  let updated = 0;
  let unchanged = 0;
  for (const [openalexId, publicationId] of byOpenAlexId) {
    const count = counts.get(openalexId);
    if (count === undefined) continue; // OpenAlex didn't return this one
    const existing = await client.publicationCitationCount.findUnique({
      where: { publicationId_source: { publicationId, source: 'openalex' } },
      select: { count: true },
    });
    if (existing && existing.count === count) {
      // Count unchanged, but bump asOf so it isn't re-checked next run.
      await client.publicationCitationCount.update({
        where: { publicationId_source: { publicationId, source: 'openalex' } },
        data: { asOf: new Date() },
      });
      unchanged += 1;
      continue;
    }
    await client.publicationCitationCount.upsert({
      where: { publicationId_source: { publicationId, source: 'openalex' } },
      update: { count, asOf: new Date() },
      create: { publicationId, source: 'openalex', count, asOf: new Date() },
    });
    updated += 1;
  }

  logger.info({ checked: candidates.length, updated, unchanged }, 'Citation counts refreshed');
  return { checked: candidates.length, updated, unchanged };
}
