# Phase F2 — DataCite Adapter & Research-Output Discovery (Implementation Notes)

> **Status:** Implemented and validated (incl. real-DB smoke with a stubbed provider). Awaiting review.
> First federation phase touching a **new** source. The DataCite adapter is implemented and offline/fixture-tested; **live ingestion is gated on final DataCite terms sign-off** (see `SCHOLARLY-DATA-SOURCES.md`). No schema change; per §45 the `UnifiedWorkRecord` remains F5.

## Delivered

### `packages/federation`
- **`DataCiteMetadataProvider`** (§4, §5) — DataCite as a first-class source for **research objects**: `getWork(doi)`, `searchWorks({orcid|name, resourceTypes})`, `healthCheck`. Pure `mapDataCite` maps `resourceTypeGeneral` → dataset/software/publication/report/other, extracts ORCID creators, and carries provenance. Injectable HTTP → **offline unit-tested**.
- **Interface extension** — `searchWorks?` + `WorkSearchQuery` added to `ScholarlyMetadataProvider` (§24–§26); `datacite` registered in the factory + `allFederationProviders`.

### Core — `research-outputs-discovery.ts`
- **`discoverResearchOutputs(researcherId)`** (§24, §25, §26) — searches DataCite (default) by the researcher's ORCID (or name) for **datasets and software**, returning provenance-bearing **candidates**. Never claims ownership automatically (§25). Provider injectable for tests.

### Web
- **`/dashboard/discover-outputs`** — lists discovered dataset/software candidates with resource type, DOI, and source/original-record link; clearly labelled candidates; prompts ORCID connection when absent.

## Validation results
- **Tests:** 12 federation unit tests (+4: `mapDataCite` dataset/software, `getWork`, `searchWorks` resource-type filter).
- **Type-check / Lint:** clean across all packages (sequential).
- **Real-DB smoke:** 83/83 — +3: discovers dataset **and** software outputs, they **carry DataCite provenance** (§38), and discovery **uses the researcher's ORCID** (validated offline with a stubbed provider).
- **Build:** web app builds with the new dashboard page.

## Integrity notes (§25, §37, §38)
- Datasets/software are treated as first-class research outputs (§4).
- Discovered outputs are **candidates only** — no automatic ownership (§25).
- Every candidate carries DataCite provenance; DataCite is evidence, not authoritative for identity (§37).
- **No live DataCite calls** were made — validation is offline/fixture; live enablement is gated on terms sign-off.

## Deferred (documented)
- Persisting claimed outputs as `Dataset`/`Software` records on claim (enrichment) — F2 returns candidates; the existing output models already support manual creation.
- `UnifiedWorkRecord` + conflict resolution + citation edges → **F5** (per §45 order).
- Live DataCite ingestion → after terms sign-off; a `federation.sync` worker job → F6.

## Exit gate
A DataCite adapter (get/search/health) behind the federation interface, and a researcher-scoped dataset/software discovery service returning provenance-bearing candidates without auto-claiming; offline/fixture-validated. **STOP FOR REVIEW.**
