# Phase F1 — Scholarly Metadata Provider Abstraction (Implementation Notes)

> **Status:** Implemented and validated. Awaiting review.
> First build phase of the Federation epic (addendum §2, §45). **No new external data sources** — only Crossref and OpenAlex (already approved) are re-expressed under the new abstraction. No schema changes.

## Delivered

### `packages/federation` (new)
- **`ScholarlyMetadataProvider`** interface (§2) — a provider-agnostic superset of the discovery provider: `capabilities` (declares which optional methods a source supports), `healthCheck()`, and `getWork(id)`. The core depends only on the interface + factory, never a concrete provider.
- **`NormalizedWork`** model (§16) — resource-type-aware, carrying per-scheme external IDs (doi/pmid/pmcid/openalex/datacite/crossref/ojs), authors, provenance, and a **source-specific** citation count (never merged, §30). `toNormalizedWork` maps the existing adapters' `NormalizedPublication` into it (pure, tested).
- **`CrossrefMetadataProvider`** (§3) + **`OpenAlexMetadataProvider`** (§9) — thin wrappers over the existing `integration-crossref` / `integration-openalex` `fetchByDoi`, with injectable HTTP so they're **unit-tested offline** with no network. `getWork` + `healthCheck`.
- **`timedHealthCheck`** (§34) — liveness/latency probe classifying healthy/warning/down from HTTP status + latency; the seed of the source-health dashboard (F6).
- **`createFederationProvider` / `allFederationProviders`** factory (§2, §45) — `crossref | openalex` today; DataCite/PubMed/ROR register here in F2–F4 behind the same interface.

## Validation results
- **Tests:** 8 federation unit tests — `toNormalizedWork` mapping, health status (200/4xx/5xx/throw), `getWork` via injected fetch for both providers, DOI-required guard, and the factory. All offline (no network).
- **Type-check / Lint:** clean across all packages (sequential).
- **Build:** unchanged web app still builds (no web/core changes in F1).

## Integrity notes (§2, §9, §30)
- Providers are evidence sources behind one interface; the core is not coupled to any of them.
- OpenAlex/Crossref remain evidence, never sole source of truth.
- Citation counts stay source-specific in `NormalizedWork.citationCount` — never blended.
- No new data source is touched; the compliance register (`SCHOLARLY-DATA-SOURCES.md`) is unchanged.

## Next (F2)
DataCite adapter + `UnifiedWorkRecord` research-object model + dataset/software discovery (§4–§5, §25–§26) — **after** the DataCite row in `SCHOLARLY-DATA-SOURCES.md` is reviewed.

## Exit gate
A provider-agnostic `ScholarlyMetadataProvider` with Crossref + OpenAlex re-expressed under it, a normalized work model, health checks, and a factory — all offline-tested, no new external sources. **STOP FOR REVIEW.**
