# Phase 4 — OJS Integration (Implementation Notes)

> **Status:** Implemented and validated (unit tests / typecheck / lint / build green). **Live end-to-end sync against the running OJS 3.4 is pending the Docker stack** (Docker is not installed in this build environment). See the honest limitation note below.

Delivers the OJS editorial-layer integration: runtime version/capability detection, standards-based OAI-PMH harvesting, idempotent sync that reuses the core publication pipeline, a worker job, and an admin sync dashboard.

## Delivered

### Data model (`packages/db`)
Mapping tables `OjsSource`, `OjsJournal`, `OjsArticle`, `OjsAuthor` + `SyncJob` / `SyncLog`; enums `SyncStatus`, `SyncKind`, `OjsStrategy`.

### Integration (`@researchtrics/integration-ojs`)
- **Capability probe** (`probeOjs`): tries site-wide OAI endpoints, detects OJS version from `Identify`, checks native-REST presence, selects a strategy. **Nothing hard-coded** (Spec §12, §93).
- **OAI-PMH client + Dublin Core mapper** (`oai.ts`): `Identify` / `ListSets` / `ListRecords` with resumption-token paging; DC → `NormalizedPublication`. Pure parsing/mapping is **unit-tested**.
- **Strategy** (`strategy.ts`): `harvestOai` (implemented) + `harvestRest` (scaffold, verification-required).
- **Idempotent sync** (`sync.ts`): keyed on OJS article id + DOI via `ojs_articles`; record-hash short-circuits unchanged records; reuses `createPublicationFromNormalized` (ORCID-only author linking, source-labelled counts, provenance `source=ojs`, audit). `SyncJob`/`SyncLog` lifecycle.

### Worker (`apps/worker`)
`ojs.sync` processor runs a full harvest; retry/backoff via BullMQ.

### Web / Admin (`apps/web`)
- Admin-gated console (`/admin`, `/admin/ojs`, `/admin/researchers`, `/admin/publications`).
- `/admin/ojs`: add source (probes on add), detected version/OAI/REST badges, "Sync now" (enqueues to the worker — never inline, Spec §43), recent sync-job table.
- API: `POST /api/v1/admin/ojs/sources`, `POST /api/v1/admin/ojs/sources/[id]/sync`.
- BullMQ producer helper; admin RBAC guard.

See [`OJS-INTEGRATION.md`](./OJS-INTEGRATION.md) and [`ADMIN.md`](./ADMIN.md).

## Validation results
- **Tests:** 49 passing (+4 OJS: Identify/version, ListSets, ListRecords + DC mapping).
- **Type-check / Lint:** clean across all **11 packages**.
- **Build:** web (incl. admin + OJS routes) + worker compile.

## Honest limitation (Spec §12, §93)
Docker is **not installed** in the current environment, so I could not start the fresh OJS 3.4 and run a live probe/harvest. The design honours "inspect first": version and capabilities are detected **at runtime**, and harvesting uses **OAI-PMH** — a standardized protocol whose parsing/mapping is fully unit-tested against representative XML. The native REST strategy is deliberately a **scaffold** pending in-environment verification. To validate end-to-end: bring up the Docker stack, grant an admin role (`docs/ADMIN.md`), add the source, and Sync now.

## Integrity notes
- **Idempotent, no duplicates** (mapping + DOI + record hash).
- **Never overwrites verified researcher identity**; author auto-linking is ORCID-only (Spec §58).
- **Provenance** on every synced record (Spec §84); every run audited via `sync_jobs`/`sync_logs`.
- **Heavy work in the worker**, enqueued from the admin action (Spec §43).

## Deferred within the phase (documented)
- Native REST harvest implementation (verify against detected version first).
- OAI sets → `ojs_journals` population; issue-level mapping.
- Scheduled/webhook sync triggers (the job is ready; scheduling is an ops wiring step).
- Admin-bootstrap CLI (currently a documented SQL grant).

## Exit gate
Adapter detects version/capabilities at runtime; OAI-PMH harvest maps DC → publications idempotently through the core pipeline with provenance; admin can register a source and trigger a worker sync; parsing/mapping/idempotency unit-tested. **STOP FOR REVIEW** before Phase 5 (Google Scholar Optimization) — with the note that live OJS validation should be run on the Docker stack.
