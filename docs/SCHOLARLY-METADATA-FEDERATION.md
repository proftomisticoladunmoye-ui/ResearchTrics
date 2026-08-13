# Scholarly Metadata Federation — Architecture (F0, addendum §46)

> **Status:** Architecture proposal for approval. **No large-scale ingestion begins until this is approved** (addendum §46). This document extends — never weakens — the existing master spec and phases.

## 0. Purpose & guardrails

Expand ResearchTrics into a **scholarly metadata federation** that discovers, normalizes, connects, and verifies records across legitimate providers (Crossref, DataCite, OpenAlex, PubMed, ORCID, OJS, ROR), building one grounded knowledge layer over researchers, outputs, institutions, journals, funders, topics, and citations.

Non-negotiables carried forward:
- **No scraping** of ResearchGate/Academia.edu/Google Scholar/LinkedIn/Scopus/Web of Science; no private-email harvesting; no sensitive-attribute inference (§44).
- **Providers never overwrite the master record** (§18). Every value keeps its provenance (§38); conflicts are stored, not silently resolved (§19).
- **Identity confidence ≠ RVM**; more databases ≠ higher RVM; RVM stays "pending validation" (§39).
- **Nothing is asserted as "you" before verification** (claiming, §37).
- AI assists but is **never the sole basis** for identity/authorship/ownership/institutional verification (§41).

## 1. What already exists (reused, not rebuilt)

The current codebase already provides much of the substrate:

| Capability | Where |
|---|---|
| `external_records` table (source/sourceId/sourceUrl/raw+normalized payload/confidence/retrieved/synced, unique per `(source, sourceId, entityType, entityId)`) | `packages/db` — **matches addendum §17 exactly** |
| Source-distinguishable citation counts (never blindly merged) | `PublicationCitationCount` unique per `(publication, source)` (§30) |
| Publication external IDs (doi/pmid/pmcid/arxiv/openalex/handle) | `PublicationIdScheme` |
| Researcher external IDs (orcid/openalex/scopus/wos/scholar_url/ror) | `ResearcherIdentifier` |
| `ExternalSource` enum incl. `datacite` | `packages/db` |
| Crossref / OpenAlex / ORCID / OJS adapters | `packages/integrations/*`; polite fetch in `integration-shared` |
| Discovery provider pattern + identity report + provisional profiles + claiming + review/merge + provenance | `packages/discovery`, `core/discovery`, `core/claiming`, `core/review` (Discovery Engine D1–D4) |
| Identity resolution (multi-evidence, never name-alone) | `core/matching`, `discovery/identity` |
| Knowledge graph (researcher ego-graph + explained paths) | `core/graph` |
| Unified `/discover` search across 8 entity types | `packages/search` |
| Google Scholar compliance checker + sitemaps + Person JSON-LD + canonical | `core/scholar-compliance`, Phase 5 |
| RVM (transparent, versioned, "pending validation") | `core/rvm` |
| No-scrape source register | `docs/DATA-SOURCE-COMPLIANCE.md` |

**Implication:** federation is mostly *new adapters + a unification/conflict layer + dashboards*, not a rewrite.

## 2. Provider abstraction (§2)

Introduce `ScholarlyMetadataProvider` in a `packages/federation` package — a superset of the existing `ResearcherDiscoveryProvider`. HTTP stays injectable (offline-testable), config-gated, polite-pool-aware.

```ts
interface ScholarlyMetadataProvider {
  readonly name: string;          // 'crossref' | 'datacite' | 'openalex' | 'pubmed' | 'orcid' | 'ojs' | 'ror'
  readonly external: boolean;
  readonly capabilities: ProviderCapability[]; // which methods it supports
  healthCheck(): Promise<ProviderHealth>;               // §34
  search?(q: FederatedQuery): Promise<ExternalRecordRef[]>;
  discover?(q: DiscoveryQuery): Promise<DiscoveredResearcher[]>;   // already exists
  getWork?(id: PersistentId): Promise<NormalizedWork>;
  getAuthor?(id: PersistentId): Promise<NormalizedAuthor>;
  getInstitution?(id: PersistentId): Promise<NormalizedInstitution>; // ROR
  getCitations?(id: PersistentId): Promise<CitationEdge[]>;
  getRelatedWorks?(id: PersistentId): Promise<ExternalRecordRef[]>;
}
```

- Not every provider implements every method — `capabilities` declares support; callers check before invoking.
- The existing discovery providers (OpenAlex/Crossref/fixture) are re-expressed under this interface without behavior change.
- **Core never depends on a concrete provider** — only on the interface and a `createFederationProvider(name, config)` factory.

## 3. Data model changes (§5, §16, §17)

Additive migration; existing tables untouched.

1. **`UnifiedWorkRecord`** (§16) — a normalized master record for a research output, keyed by an `RTW-` public id, holding: title/subtitle/abstract, resource type (publication/dataset/software/report/protocol/instrument/other, §5), publication date, all external IDs (doi/pmid/pmcid/openalex/datacite/crossref/ojs), license, topics/keywords, funding, related identifiers, versions, `confidence`, timestamps. It **references** existing `Publication`/`Dataset`/`Software`/`Instrument` rather than replacing them (backward-compatible; those stay first-class).
2. **`external_records`** — already present; becomes the universal per-source provenance store for all entity types (§17, §38). No change needed beyond usage.
3. **`FieldProvenance` / conflict store** (§19) — per `(unifiedWorkId, field)`: every source's value + `retrievedAt` + `confidence` + `authoritative` flag + `conflictStatus`. The displayed value is chosen by configurable **source-priority rules** (§19), never by silent overwrite.
4. **Citation edges** (§30) — `CitationEdge(citingId, citedId, source, retrievedAt)` stored as *relationships*, distinct from `PublicationCitationCount`. Counts and edges from different sources stay separable.
5. **ROR institution fields** (§8) — `Institution` already has `rorId`; add `aliases`/`canonicalName`/`institutionType` normalization backed by ROR.
6. **Provider sync state** (§34, §35) — `ProviderSyncState(provider, lastSuccessAt, errorRate, rateLimitStatus, imported, updated, failed)` for the health dashboard.

## 4. Data flow / normalization pipeline (§18)

```
INGESTION (adapter, polite pool, cache)
   ↓  raw payload → external_records
VALIDATION (schema/shape guards)
   ↓
NORMALIZATION (adapter maps to NormalizedWork/Author/Institution)
   ↓
IDENTITY RESOLUTION (core/matching + discovery/identity; confidence-scored)
   ↓
DEDUPLICATION (strong-id first; review queue for ambiguity — never name-alone)
   ↓
PROVENANCE STORAGE (external_records + FieldProvenance)
   ↓
CONFLICT RESOLUTION (source-priority rules → authoritative value; conflicts retained)
   ↓
MASTER RECORD (UnifiedWorkRecord — providers never overwrite it directly, §18)
   ↓
SEARCH INDEX (packages/search) + KNOWLEDGE GRAPH (core/graph)
```

## 5. Source priority (§19, §37) — configurable, not absolute

| Concern | Priority order |
|---|---|
| Researcher identity | ORCID (OAuth-verified) › institutional verification › publisher/OJS › Crossref › OpenAlex › name similarity |
| Journal publication metadata | Publisher/OJS › Crossref › OpenAlex |
| DOI research objects (datasets/software) | DataCite › Crossref |
| Biomedical metadata | PubMed (+ MeSH) |
| Scholarly graph relationships | OpenAlex |
| Institutional identity | ROR › ORCID/OpenAlex affiliation strings |

Rules live in config; **researcher corrections always win and are audited** (§19, §37).

## 6. Identity resolution & dedup (§20)

Extend the existing engine to weigh evidence from all sources (ORCID, DOI authorship, OpenAlex author id, PubMed author record, ROR/institution, coauthors, topics, country). Confidence-scored; **never name alone** (§20). Ambiguity → the existing human review queue (§57); merges are audited and reversible-by-record.

## 7. Provenance & citations (§30, §38)

Every displayed fact traces to `external_records` (source + retrievedAt). Citation **counts** stay per-source (`PublicationCitationCount`); citation **edges** are stored separately (`CitationEdge`) and labelled by source. **No blind merging** across Crossref/OpenAlex/OpenCitations.

## 8. Synchronization (§35)

Every provider supports initial import, incremental sync (`lastSyncedAt`), retry, rate limiting, caching, error handling, logging, checkpointing. **Large imports run only in the worker** (`discovery.run`/new `federation.sync` queues), never in a web request. `healthCheck()` feeds `ProviderSyncState` and the admin **Source Health** dashboard (§34).

## 9. Security & privacy (§44)

Legitimate APIs / public metadata / licensed data only. No restricted-platform scraping, no private-email harvesting, no sensitive-attribute inference. OAuth tokens encrypted at rest (existing `crypto`). Provider API keys via env, never committed. Public pages index only public metadata; private profiles stay `noindex`.

## 10. Rate limits & compliance (§36)

Each connector implements rate limit + backoff + retry + cache + timeout + circuit breaker. Per-provider terms/license/attribution/limits/retention recorded in **`docs/SCHOLARLY-DATA-SOURCES.md`** (companion register). **No source is integrated until its current official docs + terms are reviewed** (§36, §46).

## 11. Future providers (§12–§15) — architected, not implemented

OpenCitations, DOAJ, OpenAIRE, Semantic Scholar, DSpace, EPrints, Scopus, Web of Science slot in behind `ScholarlyMetadataProvider` with their own compliance review. **Not implemented unless explicitly requested** (addendum). DOAJ inclusion is never used as a quality score (§13).

## 12. RVM inputs (§39, §40)

The richer data layer feeds RVM *inputs* (discoverability, output connectivity, citation influence, open science, international reach) — but more sources never automatically raise RVM, and RVM stays a distinct, "pending validation" framework. A **Research Visibility Audit** (§40) surfaces multi-source coverage + gaps + recommended actions (grounded, no fabricated metrics).

## 13. Proposed phase sequence (per §45 order)

| Phase | Deliverable | Notes |
|---|---|---|
| **F0** | **This doc** + `SCHOLARLY-DATA-SOURCES.md` | *approval gate — no ingestion* |
| **F1** | `packages/federation` + `ScholarlyMetadataProvider` + re-express Crossref/OpenAlex under it + `healthCheck` | offline/fixture-tested |
| **F2** | **DataCite** adapter + research-object model (`UnifiedWorkRecord`, dataset/software discovery) (§4–§5, §25–§26) | |
| **F3** | **PubMed** adapter + biomedical footprint (§6–§7, §27) | |
| **F4** | **ROR** adapter + institution normalization (§8) | |
| **F5** | Unified record + `FieldProvenance` + conflict resolution + citation edges (§16, §18–§19, §30) | |
| **F6** | Source-health dashboard + search source filters + Research Visibility Audit + data-quality framework (§33–§34, §40, §42) | |
| then | **Phase 15 — hardening** covers all of the above | |

Each phase ends **STOP FOR REVIEW**, validates offline against embedded-postgres with fixtures (no live keys/DB), and only wires live providers after their compliance-register row is reviewed.

## 14. What needs live setup (flagged early)

Live ingestion, provider API keys/mailto, and a persistent database are only needed to run federation *for real* — validation stays offline/fixture-based throughout. These will be called out explicitly at go-live; nothing is connected without notice.
