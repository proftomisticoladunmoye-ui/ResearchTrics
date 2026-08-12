# Phase 10 — RVM Prototype (Implementation Notes)

> **Status:** Implemented and validated. **Completes the MVP.** Awaiting review.
> **Integrity:** RVM is version `rvm-proto-0.1` with **provisional weights, pending empirical validation** — labelled as such everywhere it surfaces. It measures **visibility**, not impact and not quality (Spec §23, §24).

## Delivered

### Data model (`packages/db`)
`RvmScore` snapshots (subject, version, overall, dimensions JSON, confidence, missing-data, calculatedAt) — versioned + transparent so historical scores are reproducible (Spec §25).

### Scoring engine (`packages/core/rvm.ts`) — pure & transparent
- **10 dimensions** (Spec §23): Discoverability, Accessibility, Scholarly Engagement, Citation Influence, Collaboration Reach, Research Connectivity, Open Science, Knowledge Translation, International Reach, Digital Scholarly Presence.
- Each dimension exposes its **indicators with raw value, normalization, and weight**; each result carries **overall (0–100), confidence, missing-data, version, and a disclaimer**.
- **Configurable** weights (`DEFAULT_DIMENSION_WEIGHTS`) — data, not magic. Saturating normalizers give diminishing returns; ratios return *missing* (not zero) when uncomputable, which lowers confidence honestly.
- **Unit-tested** (7 cases): 10 dimensions + disclaimer, strong ≫ empty, bounds, missing-data/confidence, transparent per-indicator breakdown, citation-influence marked missing without sources.

### Service (`packages/core/rvm-service.ts`)
- `gatherRvmInput` aggregates the researcher's real signals (publications, DOIs, abstracts, open access, source-labelled citations, collaborators, institutions, countries, connected outputs, ORCID, external IDs, profile).
- **Profile completeness** (Spec §31) with an explicit checklist.
- **"Improve My Visibility"** recommendations (Spec §30) — prioritized and actionable, derived from the same signals (never unexplained).
- `computeAndStoreRvm` / `getOrComputeRvm` snapshot to `rvm_scores`; the previous snapshot drives the **trend** (Δ vs previous).

### Web (`apps/web`)
- **`/dashboard/rvm`**: gold overall headline, trend vs previous, confidence + version + disclaimer, profile-completeness bar, **Improve-My-Visibility** list, and every **dimension with expandable transparent indicators** (raw / normalized / weight / no-data).
- `POST /api/v1/rvm/recompute` (per-researcher aggregation is light; runs on demand). Dashboard links updated.

## Validation results
- **Tests:** 68 passing (+7 RVM engine).
- **Type-check / Lint:** clean across all 12 packages.
- **Build:** `/dashboard/rvm` + `/api/v1/rvm/recompute` compile.

## Integrity & anti-gaming (Spec §23, §24, §65)
- **Visibility ≠ impact ≠ quality** stated in the UI and the engine's disclaimer.
- Weights **provisional / pending validation**; the framework is versioned so a validated model supersedes it with history intact.
- Citation inputs use the **max across sources**, never merged (Spec §33).
- Engine consumes bot-filtered counts (real engagement analytics + anomaly detection arrive in Phase 9); the prototype marks the engagement dimension's data honestly and lower-confidence where signals are absent.

## Deferred (post-MVP, documented)
- Admin **weight-configuration UI** (weights are code constants now; the engine already accepts a config object).
- **Institutional RVM** and field/career-stage normalization (Spec §26, §88, §89).
- Real engagement analytics feeding the Engagement dimension (Phase 9).
- Psychometric **validation module** (reliability/EFA/CFA/validity) — explicitly future (Spec §24).

## Exit gate
RVM computes transparently with provisional weights, confidence, and missing-data; researcher dashboard shows overall + dimensions + recommendations + completeness + trend; labelled proprietary/pending-validation throughout; engine unit-tested. **MVP is now feature-complete.** STOP FOR REVIEW.
