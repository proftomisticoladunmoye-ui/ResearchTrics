# Phase D2 — Researcher Discovery: Live Ingestion (Implementation Notes)

> **Status:** Implemented and validated (incl. real-DB smoke). Awaiting review.
> Adds live discovery providers, a tracked batch runner, a background job, and the admin "Discover researchers" console. Live providers are **config-gated** and **validated offline** with injected HTTP — no network in tests.

## Delivered

### Live discovery providers (`packages/discovery`)
- **`OpenAlexDiscoveryProvider`** (§6) — queries the OpenAlex Authors API (ROR / country / ORCID filters + search), maps authors via pure `mapOpenAlexAuthor` (strips id/ORCID URLs, institution, country, topics, works_count) with provenance. OpenAlex is **evidence only**, never authoritative (§37).
- **`CrossrefDiscoveryProvider`** (§7) — discovers authors from works via the polite pool; pure `extractCrossrefAuthors` keys distinct authors by ORCID (else name), accumulating works, co-authors, and subjects.
- **`createDiscoveryProvider(name, config)`** factory (§39) — `fixture | openalex | crossref`. HTTP is injectable (`politeFetchJson` `fetchImpl`), so providers are unit-tested with canned JSON — **no network, no keys** in tests. Live calls join the polite pool via env `mailto` and only happen when a run executes.

### Core — `runDiscovery`
- Records a **`DiscoveryRun`** (provider, query, status, counts), discovers candidates, materializes provisional profiles via `createProvisionalResearcher`, and tallies **created / matched / suppressed**. Idempotent (existing profiles matched, never duplicated); failures mark the run `failed` with the error. Plus `listDiscoveryRuns`.

### Worker (`apps/worker`)
- New **`discovery.run`** queue + processor: resolves the provider from env config and runs `runDiscovery` — large campaigns run here, **never in a web request** (§52).

### Web admin (`apps/web`)
- **`/admin/discovery`** — a "Discover researchers" form, a recent-runs table (source/status/counts), and an unclaimed-profiles table (name/country/ORCID/OpenAlex/confidence/status/profile link) (§22, §40). Added to admin nav.
- **`POST /api/v1/admin/discovery/run`** (admin-guarded): the offline `fixture` provider runs **inline** for the controlled prototype (§67); `openalex`/`crossref` are **enqueued** to the worker.

## Validation results
- **Tests:** 102 passing (+9 provider mappers/factory — OpenAlex + Crossref extraction, URL builders, offline `discover` via injected fetch).
- **Type-check / Lint:** clean across all packages (sequential).
- **Real-DB smoke:** 64/64 — a fixture discovery **run records counts** (discovered/created/matched), a re-run is **idempotent** (0 created), and runs are listed for the dashboard.

## Integrity notes (§37, §38, §52, §61)
- Live providers are evidence sources, config-gated, and rate-friendly (polite pool via `mailto`); no restricted platforms are touched (see `DATA-SOURCE-COMPLIANCE.md`).
- Bulk discovery runs in the worker queue, never inline in a request.
- Every discovered candidate and field remains provenance-backed; profiles stay **unclaimed** until verified.

## Deferred (documented)
- Persisting a discovered author's institution as an (unverified) `Affiliation` + `Institution` link — currently kept as provenance; enrichment lands in D3.
- Incremental/`last_synced_at`-aware sync + circuit breakers per connector (§59, §60) — polite fetch + caching exist; full scheduling is a later hardening item.
- ORCID public-search discovery provider (ORCID OAuth already exists for claiming).

## Exit gate
Config-gated OpenAlex + Crossref discovery providers (offline-tested), a tracked batch runner, a background discovery job, and an admin discovery console; verified against a live database. **STOP FOR REVIEW.**
