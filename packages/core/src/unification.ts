import {
  prisma,
  type PrismaClient,
  type Prisma,
  type ExternalSource,
  nextWorkSerial,
} from '@researchtrics/db';
import type { NormalizedWork } from '@researchtrics/federation';
import { formatWorkId } from './id';
import { badRequest } from './errors';

/**
 * Metadata unification & conflict resolution (Federation §16, §18, §19, §30).
 *
 * Multiple providers describe the same work. A **conflict-aware resolver**
 * chooses each field's value by configurable source priority; every source's
 * value is retained with its conflict status. Providers never overwrite the
 * master record directly (§18). Citation counts from different sources stay
 * distinguishable — they are stored as edges, never blindly merged (§30).
 */

// ---------- Source priority (configurable, §19) ----------

/** Per-field source preference order. Falls back to DEFAULT_PRIORITY. */
export const SOURCE_PRIORITY: Record<string, string[]> = {
  title: ['ojs', 'crossref', 'openalex', 'datacite', 'pubmed'],
  abstract: ['crossref', 'pubmed', 'openalex', 'ojs'],
  journalTitle: ['ojs', 'crossref', 'openalex', 'pubmed'],
  publisher: ['datacite', 'crossref', 'ojs'],
  publishedYear: ['ojs', 'crossref', 'pubmed', 'openalex', 'datacite'],
  licenseCode: ['crossref', 'ojs', 'datacite'],
};
const DEFAULT_PRIORITY = ['crossref', 'openalex', 'datacite', 'pubmed', 'ojs'];

// ---------- Pure resolver (tested) ----------

export interface FieldCandidate {
  source: string;
  value: string | null;
}

export type ConflictStatus = 'none' | 'single' | 'conflict';

export interface ResolvedField {
  field: string;
  value: string | null;
  source: string | null;
  conflictStatus: ConflictStatus;
  candidates: FieldCandidate[];
}

/**
 * Resolve one field from competing source values. Returns the chosen value
 * (highest-priority source that has one), whether the sources agree, and every
 * candidate. Pure + deterministic.
 */
export function resolveField(
  field: string,
  candidates: FieldCandidate[],
  priority: Record<string, string[]> = SOURCE_PRIORITY,
): ResolvedField {
  const present = candidates.filter((c) => c.value != null && c.value !== '');
  if (present.length === 0) {
    return { field, value: null, source: null, conflictStatus: 'none', candidates };
  }
  const distinct = new Set(present.map((c) => c.value!.trim().toLowerCase()));
  const conflictStatus: ConflictStatus = distinct.size > 1 ? 'conflict' : 'single';

  const order = priority[field] ?? DEFAULT_PRIORITY;
  let chosen: FieldCandidate | undefined;
  for (const src of order) {
    chosen = present.find((c) => c.source === src);
    if (chosen) break;
  }
  chosen ??= present[0]!;

  return { field, value: chosen.value, source: chosen.source, conflictStatus, candidates };
}

const STRING_FIELDS = ['title', 'abstract', 'journalTitle', 'publisher', 'licenseCode'] as const;

export interface ResolvedWork {
  resourceType: string;
  fields: Record<string, ResolvedField>;
  externalIds: NonNullable<NormalizedWork['externalIds']>;
  authors: NormalizedWork['authors'];
  /** Distinct contributing sources. */
  sources: string[];
  /** 0..1 — more sources raise it, conflicts lower it. */
  confidence: number;
}

function pick(work: NormalizedWork, field: (typeof STRING_FIELDS)[number]): string | null {
  const v = (work as unknown as Record<string, unknown>)[field];
  return typeof v === 'string' && v ? v : null;
}

/**
 * Resolve a set of provider records for the *same* work into one master view.
 * External IDs are additive (union); scalar fields go through the conflict
 * resolver. Pure + tested.
 */
export function resolveWork(candidates: NormalizedWork[]): ResolvedWork {
  const sources = Array.from(new Set(candidates.map((c) => c.source)));
  const fields: Record<string, ResolvedField> = {};

  for (const f of STRING_FIELDS) {
    fields[f] = resolveField(
      f,
      candidates.map((c) => ({ source: c.source, value: pick(c, f) })),
    );
  }
  fields.publishedYear = resolveField(
    'publishedYear',
    candidates.map((c) => ({ source: c.source, value: c.publishedYear != null ? String(c.publishedYear) : null })),
  );

  // External IDs — additive union; first non-empty by source order.
  const externalIds: NonNullable<NormalizedWork['externalIds']> = {};
  for (const key of ['doi', 'pmid', 'pmcid', 'openalex', 'datacite', 'crossref', 'ojs'] as const) {
    for (const c of candidates) {
      const v = c.externalIds?.[key];
      if (v) {
        externalIds[key] = v;
        break;
      }
    }
  }

  // Authors from the highest-priority source that has any.
  let authors: NormalizedWork['authors'] = [];
  for (const src of DEFAULT_PRIORITY) {
    const withAuthors = candidates.find((c) => c.source === src && c.authors.length > 0);
    if (withAuthors) {
      authors = withAuthors.authors;
      break;
    }
  }
  if (authors.length === 0) authors = candidates.find((c) => c.authors.length > 0)?.authors ?? [];

  const resourceType = candidates[0]?.resourceType ?? 'publication';
  const conflicts = Object.values(fields).filter((f) => f.conflictStatus === 'conflict').length;
  const confidence = Math.max(0, Math.min(1, sources.length * 0.34 - conflicts * 0.05));

  return { resourceType, fields, externalIds, authors, sources, confidence };
}

// ---------- Persistence (§16, §17, §19) ----------

const ENUM_SOURCES = new Set<ExternalSource>(['crossref', 'orcid', 'openalex', 'ojs', 'datacite', 'pubmed', 'ror', 'user']);

export interface UnifiedWorkResult {
  id: string;
  publicId: string;
  doi: string;
  status: 'created' | 'updated';
  conflicts: string[];
}

/**
 * Create or update the unified master record for a set of provider records that
 * describe the same work (keyed by shared DOI). Persists the resolved values,
 * per-field provenance (all source values + conflict status), and raw external
 * records. Idempotent on DOI; providers never write the master directly.
 */
export async function upsertUnifiedWork(
  candidates: NormalizedWork[],
  client: PrismaClient = prisma,
): Promise<UnifiedWorkResult> {
  const doi = candidates.map((c) => c.externalIds?.doi).find((d): d is string => !!d);
  if (!doi) throw badRequest('A shared DOI is required to unify records');

  const resolved = resolveWork(candidates);
  const val = (f: string) => resolved.fields[f]?.value ?? null;
  const yearStr = resolved.fields.publishedYear?.value;
  const publishedYear = yearStr ? Number(yearStr) : null;

  const existing = await client.unifiedWorkRecord.findUnique({ where: { doi }, select: { id: true } });

  const data = {
    resourceType: resolved.resourceType,
    title: val('title') ?? candidates[0]?.title ?? '(untitled)',
    abstract: val('abstract'),
    journalTitle: val('journalTitle'),
    publisher: val('publisher'),
    licenseCode: val('licenseCode'),
    publishedYear: Number.isFinite(publishedYear) ? publishedYear : null,
    pmid: resolved.externalIds.pmid ?? null,
    pmcid: resolved.externalIds.pmcid ?? null,
    openalexId: resolved.externalIds.openalex ?? null,
    dataciteId: resolved.externalIds.datacite ?? null,
    crossrefId: resolved.externalIds.crossref ?? null,
    ojsId: resolved.externalIds.ojs ?? null,
    confidence: resolved.confidence,
  };

  let recordId: string;
  let status: 'created' | 'updated';
  if (existing) {
    await client.unifiedWorkRecord.update({ where: { id: existing.id }, data });
    recordId = existing.id;
    status = 'updated';
  } else {
    const serial = await nextWorkSerial(client);
    const created = await client.unifiedWorkRecord.create({
      data: { ...data, doi, publicId: formatWorkId(serial) },
      select: { id: true },
    });
    recordId = created.id;
    status = 'created';
  }

  // Rewrite per-field provenance (all source values retained, §19).
  await client.workFieldProvenance.deleteMany({ where: { unifiedWorkId: recordId } });
  const provRows: Prisma.WorkFieldProvenanceCreateManyInput[] = [];
  for (const rf of Object.values(resolved.fields)) {
    for (const c of rf.candidates) {
      if (c.value == null) continue;
      provRows.push({
        unifiedWorkId: recordId,
        field: rf.field,
        source: c.source,
        value: c.value,
        authoritative: c.source === rf.source,
        conflictStatus: rf.conflictStatus,
      });
    }
  }
  if (provRows.length > 0) await client.workFieldProvenance.createMany({ data: provRows });

  // Raw per-source external records (§17, §38).
  for (const c of candidates) {
    if (!ENUM_SOURCES.has(c.source as ExternalSource)) continue;
    await client.externalRecord.upsert({
      where: {
        source_sourceId_entityType_entityId: {
          source: c.source as ExternalSource,
          sourceId: c.provenance.sourceId ?? doi,
          entityType: 'work',
          entityId: recordId,
        },
      },
      create: {
        source: c.source as ExternalSource,
        sourceId: c.provenance.sourceId ?? doi,
        sourceUrl: c.provenance.sourceUrl ?? null,
        entityType: 'work',
        entityId: recordId,
        retrievedAt: new Date(c.provenance.retrievedAt),
        rawPayload: (c.raw ?? null) as Prisma.InputJsonValue,
      },
      update: { lastSyncedAt: new Date(), sourceUrl: c.provenance.sourceUrl ?? null },
    });
  }

  const conflicts = Object.values(resolved.fields)
    .filter((f) => f.conflictStatus === 'conflict')
    .map((f) => f.field);

  return { id: recordId, publicId: (await client.unifiedWorkRecord.findUniqueOrThrow({ where: { id: recordId }, select: { publicId: true } })).publicId, doi, status, conflicts };
}

export async function getUnifiedWorkByDoi(doi: string, client: PrismaClient = prisma) {
  return client.unifiedWorkRecord.findUnique({
    where: { doi },
    include: { fieldProvenance: true },
  });
}

// ---------- Citation edges (§30) ----------

/** Record source-attributed citation relationships. Idempotent per (edge, source). */
export async function recordCitationEdges(
  citingDoi: string,
  edges: Array<{ citedDoi: string; source: string }>,
  client: PrismaClient = prisma,
): Promise<number> {
  let written = 0;
  for (const e of edges) {
    await client.citationEdge.upsert({
      where: { citingDoi_citedDoi_source: { citingDoi, citedDoi: e.citedDoi, source: e.source } },
      create: { citingDoi, citedDoi: e.citedDoi, source: e.source },
      update: { retrievedAt: new Date() },
    });
    written += 1;
  }
  return written;
}

/** Per-source citation counts for a work — kept distinguishable, never merged (§30). */
export async function citationCountsBySource(
  citedDoi: string,
  client: PrismaClient = prisma,
): Promise<Record<string, number>> {
  const grouped = await client.citationEdge.groupBy({
    by: ['source'],
    where: { citedDoi },
    _count: { _all: true },
  });
  const out: Record<string, number> = {};
  for (const g of grouped) out[g.source] = g._count._all;
  return out;
}
