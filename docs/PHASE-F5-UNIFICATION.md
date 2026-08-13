# Phase F5 — Unified Work Record, Conflict Resolution & Citation Edges (Implementation Notes)

> **Status:** Implemented and validated (incl. real-DB smoke). Awaiting review.
> The unification layer that ties every provider together (addendum §16, §18, §19, §30). Backend/pipeline phase — the source-badges + conflict UI lands in F6. Offline-validated.

## Delivered

### Data model (`packages/db`) — migration → **51 tables**
- **`UnifiedWorkRecord`** (§16) — `RTW-00000001` master record: title/abstract/journal/publisher/license/year, per-scheme external IDs (doi/pmid/pmcid/openalex/datacite/crossref/ojs), `confidence`, optional 1:1 link to a `Publication`.
- **`WorkFieldProvenance`** (§19, §38) — per `(record, field, source)`: the source's value, an `authoritative` flag, and `conflictStatus`. **Every source value is retained.**
- **`CitationEdge`** (§30) — `(citingDoi, citedDoi, source)` relationships, unique per source; distinct from `PublicationCitationCount`.
- `ExternalSource` enum extended with `pubmed` + `ror`; `work_rtw_seq` + `formatWorkId`.

### Core — `unification.ts`
- **Pure resolver (tested):** configurable `SOURCE_PRIORITY` per field (§19); `resolveField` chooses the highest-priority source's value, flags agreement vs `conflict`, and returns every candidate; `resolveWork` unions external IDs, resolves scalar fields, picks authors by priority, and computes a source-count/agreement `confidence`.
- **`upsertUnifiedWork(candidates)`** (§16, §18) — builds/updates the master record from multiple provider records that share a DOI, writes per-field provenance (all values) and raw `external_records`. **Providers never overwrite the master directly** — the resolver decides. Idempotent on DOI.
- **Citations (§30):** `recordCitationEdges` (source-attributed, idempotent) + `citationCountsBySource` — counts stay per-source, never merged.

## Validation results
- **Tests:** 90 core unit tests (+6: `resolveField`/`resolveWork` — no-value, agreement, conflict+priority, ID union, publisher priority, author selection, confidence).
- **Type-check / Lint:** clean across all packages (sequential).
- **Real-DB smoke:** 93/93 — +5: unified record created with an `RTW-` id; a `publishedYear` **conflict is detected and retained** (not overwritten); **all source values kept** in field provenance; unification is **idempotent on DOI**; citation counts stay **source-distinguishable** (`{crossref:1, openalex:1}`).

## Integrity notes (§18, §19, §30, §38)
- Providers never overwrite the master — a conflict-aware resolver chooses each field by configurable priority, and disagreements are stored, not silenced.
- Every source's value is kept with provenance; the chosen one is flagged authoritative.
- Citation counts/edges from different sources remain separable and are never blended.

## Deferred (documented → F6 / later)
- Web surfacing: source badges + "sources & conflicts" panel on works, and linking `UnifiedWorkRecord` to the public publication page (§29) → **F6**.
- Auto-unification during ingestion (calling `upsertUnifiedWork` from the discovery/sync pipeline) → after live sources are enabled.
- Indexing unified records into search + the knowledge graph (§23, §28) → F6.

## Exit gate
A conflict-aware `UnifiedWorkRecord` with per-field provenance that retains all source values, and source-distinguishable citation edges — providers never overwrite the master; offline-validated. **STOP FOR REVIEW.**
