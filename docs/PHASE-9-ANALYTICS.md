# Phase 9 — Research Analytics (Implementation Notes)

> **Status:** Implemented and validated (incl. real-DB smoke). Awaiting review.

Adds honest, bot-filtered engagement analytics — and uses them to replace the profile/publication placeholders and upgrade the RVM Engagement dimension from a proxy to real signals.

## Delivered

### Data model (`packages/db`)
`AnalyticsEvent` (bot-flagged, pseudonymous `visitorHash`, referrer host — never a raw IP) + `MetricSnapshot` (trend aggregation); `AnalyticsEventType` enum covering the interaction kinds in Spec §41.

### Core (`packages/core/analytics.ts`)
- **Bot filtering** (`isBotUserAgent`) and **privacy-preserving `visitorHash`** (IP+UA salted per-UTC-day, one-way) — pure + unit-tested (Spec §41, §36, §65).
- `recordEvent` — flags bots (records but excludes from human counts) and **de-duplicates** repeat human views per visitor within a window.
- Aggregates: `getEntityMetrics`, `getResearcherAnalytics` (views, downloads, citation exports, citation total, 30-day trend, top publications), `getInstitutionAnalytics`, `getResearcherEngagement`.

### RVM upgrade
The **Engagement dimension now uses real bot-filtered views + downloads** (with output surface area as a small tertiary), closing the Phase-10 "engagement is a proxy" deferral. `gatherRvmInput` feeds real signals.

### Web (`apps/web`)
- **View tracking** on public publication, researcher (excludes self-views), project, dataset, instrument, and software pages; **citation-export downloads** recorded in the cite route. Best-effort, never blocks render.
- **Real counts** replace placeholders: publication page shows bot-filtered views/downloads; researcher profile snapshot shows real publications / citations / profile views; dashboard cards wired to real analytics.
- **`/dashboard/analytics`** — profile/publication views, downloads, citations, a 30-day view trend, and top publications.

## Validation results
- **Tests:** 51 passing (+4 analytics: bot detection, visitor-hash rotation/privacy, referrer parsing).
- **Type-check / Lint:** clean across all 12 packages.
- **Build:** `/dashboard/analytics` + tracked pages compile.
- **Real-DB smoke:** bot-excluded + de-dup behaviour verified against live Postgres (see the smoke output).

## Integrity notes (Spec §41, §65)
- **Bots recorded but flagged and excluded** from human counts.
- **No raw IPs** stored — only a daily-rotating pseudonymous hash (Spec §36).
- **Self-views excluded**, repeat views de-duplicated — anti-gaming (Spec §65).
- Counts are labelled "bot-filtered" in the UI.

## Deferred (documented)
- Worker aggregation into `MetricSnapshot` for long-range trends (events power MVP trends directly).
- Search-appearance, follow, and external-referral capture beyond the schema hooks.
- Institutional analytics dashboard surface (service is built; a page lands with the institutional platform, Phase 12).
- Geo/country enrichment (field exists; populate later without raw IPs).

## Exit gate
Interactions are recorded with bot filtering + privacy-preserving hashing; researcher/publication/institution aggregates compute; real counts surface across profile, publication, dashboard, and a dedicated analytics page; RVM engagement uses real signals; verified against a live database. **STOP FOR REVIEW.**
