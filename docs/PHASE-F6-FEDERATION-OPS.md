# Phase F6 — Federation Ops: Health, Quality, Visibility Audit, Source Badges (Implementation Notes)

> **Status:** Implemented and validated (incl. real-DB smoke). Awaiting review.
> The presentation + ops layer over F1–F5 (addendum §29, §34, §40, §42). Offline-validated. This is the **last Federation phase**; hardening (Phase 15) now covers the whole federation surface.

## Delivered

### Core — `federation-ops.ts`
- **`federationHealthReport(providers?)`** (§34) — probes every configured provider's `healthCheck`, each timeout-guarded, returning healthy/warning/down + latency.
- **`dataQualityReport()`** (§42) — grounded metrics over real records: completeness (interests/affiliation/abstract/DOI), **uniqueness** (duplicate ORCID), **validity** (ORCID format), **provenance coverage** — plus an overall 0–100 score (mean of metrics).
- **`researchVisibilityAudit(researcherId)`** (§40) — a researcher's multi-source coverage (publications, DOI, abstract, datasets, software, projects, ORCID, affiliations), detected **gaps**, and **recommended actions** — all from real records.
- **`getUnifiedWorkByPublicId(publicId)`** (§29) — the unified record with per-field provenance for display.

### Web
- **`/admin/sources`** (§34) — source-health table (status/latency/checked/detail). Honestly shows **down** in environments that make no live calls.
- **`/admin/quality`** (§42) — data-quality score + per-metric bars.
- **`/dashboard/visibility-audit`** (§40) — coverage cards, gaps, and recommendations; linked from the dashboard.
- **`/works/[id]`** (§29) — the unified work record with **source badges** and a **per-field provenance + conflict** panel (chosen value + source, with disagreements shown, never silently overwritten).
- **`SourceBadge`** component — provenance labels (ORCID/Crossref/OpenAlex/PubMed/DataCite/OJS/ROR), indicating origin, never endorsement.
- Admin nav gains **Sources** + **Quality**.

## Validation results
- **Tests:** 90 core unit tests (F6 core is DB/provider-bound, covered by smoke).
- **Type-check / Lint:** clean across all packages (sequential).
- **Real-DB smoke:** 97/97 — +4: health report probes each provider (healthy + down), data-quality yields a 0–100 score with 7 metrics, the visibility audit returns grounded coverage + recommendations, and a unified work is readable by public id with field provenance.
- **Build:** web app builds with the four new pages.

## Integrity notes (§29, §34, §40, §42)
- Every quality/audit figure is a grounded count over real records — nothing fabricated.
- Source badges indicate provenance, never endorsement; the unified-work page shows conflicts openly.
- Health honestly reports **down** where no live call is made.

## Deferred (documented)
- **§33 `/discover` source filter** — filtering the public unified search by source needs provenance indexed into the search index (a `packages/search` change). The discovery API already filters by source (§51); the full public-search facet is folded into the search work. **Not done here.**
- Persisted `ProviderSyncState` (imported/updated/failed counts, error-rate over time) — the live health probe is delivered; historical sync telemetry lands with live ingestion.
- Indexing unified records into the search index + knowledge graph.

## Exit gate
Source-health dashboard, a grounded data-quality framework, a multi-source research-visibility audit, and a unified-work page with source badges + conflict provenance; offline-validated. **Federation epic (F0–F6) complete. STOP FOR REVIEW.**
