# Phase 6 — Research Projects & Outputs (Implementation Notes)

> **Status:** Implemented and validated. Awaiting review.

Extends the scholarly graph beyond publications: projects (the hub), grants/funders, datasets, instruments (psychometric), and software — connectable to researchers, institutions, and each other (Spec §1, §19–22).

## Delivered

### Data model (`packages/db`)
`Funder`, `Grant`, `Project`, `ProjectMember`, `ProjectPublication`, `Dataset`, `Instrument`, `Software`; enums `ProjectStatus`, `DatasetAccessLevel`. Researcher/Institution/Publication back-relations; RTJ/RTD/RTI/RTS ID sequences.

### Core (`packages/core`)
- **Projects**: `createProject` (mints RTJ id + slug, adds PI as member, audited), `getProjectBySlug` (members, datasets, instruments, software, linked publications), `listProjects`, `addProjectMember`, `linkPublicationToProject`.
- **Datasets / Instruments / Software**: `create*` / `get*BySlug` / `list*` with full metadata — datasets carry access conditions (Spec §20), instruments carry **psychometric metadata** (construct, population, items, response scale, scoring, reliability, validity, factor structure, norms — Spec §21), software carries repo/DOI/license/citation (Spec §22).

### Search (`packages/search`)
Extended `SearchIndex` + Postgres provider + facets to cover **projects, datasets, instruments, software** — closing the Phase 7 deferral. `/discover` now searches all eight entity types.

### Web (`apps/web`)
- Public SSR pages: `/projects` + `/projects/[slug]` (rich hub view with team + linked outputs), `/datasets` + `/datasets/[slug]` (schema.org `Dataset` JSON-LD; **restricted-access notice**), `/instruments` + `/instruments/[slug]` (psychometric metadata), `/software` + `/software/[slug]`.
- Dashboard `/dashboard/outputs`: create forms for project, dataset, instrument, software (config-driven generic form).
- API: `POST /api/v1/{projects,datasets,instruments,software}`.
- Header gains "Projects"; dashboard links to the add-output flow.

## Validation results
- **Tests:** 61 passing (existing suites; new services exercised at runtime).
- **Type-check / Lint:** clean across all 12 packages.
- **Build:** all new list/detail/create routes compile (verified below).

## Integrity notes
- **Restricted datasets are never exposed** (Spec §20): only public records list; access level is surfaced explicitly with a notice; no restricted content is distributed through the page (file hosting with signed URLs is a later phase).
- Every output mints a persistent public ID (RTJ/RTD/RTI/RTS) and connects to its creator/PI — nothing exists in isolation (Spec §1).
- Project creation is audited (Spec §68).

## Deferred within the phase (documented)
- Dataset/instrument **file hosting** with signed URLs for restricted access (storage abstraction from Phase 3 is ready).
- Grant/funder management UI (models + relations exist; linked at project level).
- Instrument versioning/translation records and dataset versioning (fields present; version history UI later).
- Adding project members / linking existing publications from the UI (services exist; forms are a small follow-up).

## Exit gate
Projects link outputs/datasets/instruments/software with correct visibility; each output type has public pages + dashboard creation; search covers all types. **STOP FOR REVIEW** before Phase 10 (RVM prototype).
