import { createHash } from 'node:crypto';
import { prisma, type PrismaClient, type SyncKind } from '@researchtrics/db';
import {
  createPublicationFromNormalized,
  findPublicationByDoi,
  logger,
  type CreatePublicationInput,
} from '@researchtrics/core';
import type { NormalizedPublication } from '@researchtrics/integration-shared';
import { probeOjs } from './probe';
import { harvestOai, type HarvestedArticle } from './strategy';

/**
 * OJS sync (Spec §12). Idempotent and keyed on OJS-side identifiers via the
 * ojs_articles mapping table — never creates duplicates. Reuses the core
 * publication pipeline (ORCID-only author linking, provenance, audit). OJS is
 * not allowed to overwrite verified ResearchTrics researcher identity.
 */

export interface SyncResult {
  syncJobId: string;
  processed: number;
  created: number;
  updated: number;
  failed: number;
  status: 'completed' | 'partial' | 'failed';
}

function recordHash(pub: NormalizedPublication): string {
  const key = JSON.stringify({
    t: pub.title,
    a: pub.abstract,
    au: pub.authors.map((x) => x.rawName),
    j: pub.journalTitle,
    y: pub.publishedYear,
    d: pub.doi,
  });
  return createHash('sha256').update(key).digest('hex');
}

function toCreateInput(
  pub: NormalizedPublication,
  ojsArticleId: string,
  baseUrl: string,
): CreatePublicationInput {
  return {
    title: pub.title,
    abstract: pub.abstract,
    doi: pub.doi,
    outputType: pub.outputType,
    journalTitle: pub.journalTitle,
    issnElectronic: pub.issnElectronic,
    issnPrint: pub.issnPrint,
    volume: pub.volume,
    issue: pub.issue,
    firstPage: pub.firstPage,
    lastPage: pub.lastPage,
    publishedYear: pub.publishedYear,
    publishedOn: pub.publishedOn,
    publisher: pub.publisher,
    licenseCode: pub.licenseCode,
    pdfUrl: pub.pdfUrl,
    openAccess: Boolean(pub.pdfUrl),
    authors: pub.authors.map((a) => ({
      rawName: a.rawName,
      givenName: a.givenName,
      familyName: a.familyName,
      orcid: a.orcid,
      affiliation: a.affiliation,
    })),
    provenance: [{ source: 'ojs', sourceId: ojsArticleId, sourceUrl: baseUrl, raw: pub.raw }],
  };
}

/** Ensure the source has been probed; persist detected capabilities (Spec §12). */
export async function ensureProbed(
  ojsSourceId: string,
  client: PrismaClient = prisma,
  fetchImpl: typeof fetch = fetch,
): Promise<{ oaiUrl: string | null }> {
  const source = await client.ojsSource.findUnique({ where: { id: ojsSourceId } });
  if (!source) throw new Error('OJS source not found');
  if (source.oaiUrl) return { oaiUrl: source.oaiUrl };

  const probe = await probeOjs(source.baseUrl, fetchImpl);
  await client.ojsSource.update({
    where: { id: ojsSourceId },
    data: {
      oaiUrl: probe.oaiUrl ?? null,
      versionDetected: probe.versionDetected ?? null,
      strategy: probe.strategy,
      restApiAvailable: probe.restApiAvailable,
      lastProbedAt: new Date(),
    },
  });
  return { oaiUrl: probe.oaiUrl ?? null };
}

export interface SyncOptions {
  kind?: SyncKind;
  maxPages?: number;
  fetchImpl?: typeof fetch;
}

export async function syncOjsSource(
  ojsSourceId: string,
  options: SyncOptions = {},
  client: PrismaClient = prisma,
): Promise<SyncResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const source = await client.ojsSource.findUnique({ where: { id: ojsSourceId } });
  if (!source) throw new Error('OJS source not found');

  const job = await client.syncJob.create({
    data: { integration: 'ojs', kind: options.kind ?? 'manual', status: 'running', ojsSourceId, startedAt: new Date() },
  });

  const log = (level: string, message: string, entityRef?: string) =>
    client.syncLog.create({ data: { syncJobId: job.id, level, message, entityRef: entityRef ?? null } });

  let processed = 0;
  let created = 0;
  let updated = 0;
  let failed = 0;

  try {
    const { oaiUrl } = await ensureProbed(ojsSourceId, client, fetchImpl);
    if (!oaiUrl) {
      await log('error', 'No OAI-PMH endpoint detected for this OJS source');
      throw new Error('No OAI-PMH endpoint detected');
    }

    for await (const article of harvestOai(oaiUrl, { maxPages: options.maxPages }, fetchImpl)) {
      processed += 1;
      try {
        const outcome = await syncOneArticle(ojsSourceId, source.baseUrl, article, client);
        if (outcome === 'created') created += 1;
        else if (outcome === 'updated') updated += 1;
      } catch (err) {
        failed += 1;
        logger.warn({ err, ojsArticleId: article.ojsArticleId }, 'OJS article sync failed');
        await log('error', `Failed: ${(err as Error).message}`, article.ojsArticleId);
      }
    }

    const status = failed > 0 ? (created + updated > 0 ? 'partial' : 'failed') : 'completed';
    await client.$transaction([
      client.syncJob.update({
        where: { id: job.id },
        data: { status, finishedAt: new Date(), processed, created, updated, failed },
      }),
      client.ojsSource.update({ where: { id: ojsSourceId }, data: { lastSyncedAt: new Date() } }),
    ]);
    return { syncJobId: job.id, processed, created, updated, failed, status };
  } catch (err) {
    await client.syncJob.update({
      where: { id: job.id },
      data: { status: 'failed', finishedAt: new Date(), processed, created, updated, failed, error: (err as Error).message },
    });
    throw err;
  }
}

async function syncOneArticle(
  ojsSourceId: string,
  baseUrl: string,
  article: HarvestedArticle,
  client: PrismaClient,
): Promise<'created' | 'updated' | 'skipped'> {
  const hash = recordHash(article.publication);
  const mapping = await client.ojsArticle.findUnique({
    where: { ojsSourceId_ojsArticleId: { ojsSourceId, ojsArticleId: article.ojsArticleId } },
  });

  // Already imported and unchanged → idempotent no-op.
  if (mapping?.internalPublicationId && mapping.lastRecordHash === hash) return 'skipped';

  // Link to an existing publication by DOI if present, else create.
  let internalPublicationId = mapping?.internalPublicationId ?? null;
  let outcome: 'created' | 'updated' | 'skipped' = 'skipped';

  if (!internalPublicationId && article.publication.doi) {
    const existing = await findPublicationByDoi(article.publication.doi, client);
    if (existing) internalPublicationId = existing.id;
  }

  if (!internalPublicationId) {
    const result = await createPublicationFromNormalized(
      toCreateInput(article.publication, article.ojsArticleId, baseUrl),
      client,
    );
    internalPublicationId = result.publicationId;
    outcome = result.status === 'created' ? 'created' : 'updated';
  } else {
    outcome = mapping ? 'updated' : 'created';
  }

  await client.ojsArticle.upsert({
    where: { ojsSourceId_ojsArticleId: { ojsSourceId, ojsArticleId: article.ojsArticleId } },
    update: { internalPublicationId, doi: article.publication.doi ?? null, lastRecordHash: hash },
    create: {
      ojsSourceId,
      ojsArticleId: article.ojsArticleId,
      internalPublicationId,
      doi: article.publication.doi ?? null,
      lastRecordHash: hash,
    },
  });

  return outcome;
}
