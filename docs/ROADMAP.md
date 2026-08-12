# ResearchTrics — Roadmap, Risk Register & Complexity

> **Status:** Phase 0 — *Draft for review*
> Governs delivery. Every phase ends with **STOP FOR REVIEW** and may not begin until the prior phase meets the completion criteria (Spec §97).

---

## 1. Phase completion criteria (applies to every phase — Spec §97)

A phase is **done** only when: feature implemented · DB migration complete · API complete · UI complete · tests written & passing · responsive verified · accessibility checked · security reviewed · docs updated · build succeeds · no critical errors · no known severe regression. Plus, per Spec §0: lint clean, type-check clean, security review performed.

---

## 2. Phase plan

Each phase below lists its **goal**, **key deliverables**, **primary docs/tables/integrations touched**, and **exit gate**.

### Phase 0 — Discovery & Architecture *(this deliverable)*
- **Deliverables:** the five docs (MASTER-ARCHITECTURE, ROADMAP, DATABASE-ARCHITECTURE, INTEGRATION-ARCHITECTURE, RVM-FRAMEWORK) + repo assessment.
- **Exit gate:** documents + open decisions reviewed and signed off. **← WE ARE HERE.**

### Phase 1 — Foundation
- **Goal:** the skeleton everything else stands on.
- **Deliverables:** monorepo (pnpm + Turborepo), Next.js `web` + `worker` apps, Prisma + Postgres, base migrations (users/roles/researchers/institutions + provenance/audit scaffolding), auth (Argon2id, sessions, cookies), **RBAC gate**, design-system foundation in `packages/ui` (tokens, core components), base layout + navigation + footer, structured logging + centralized error handling, `.env.example`, Docker compose (web/worker/postgres/redis/minio), CI (lint/type/test/build).
- **Integrations:** none.
- **Exit gate:** app boots, auth works, RBAC enforced, design tokens live, CI green. **STOP FOR REVIEW.**

### Phase 2 — Researcher Identity
- **Goal:** authoritative internal identity.
- **Deliverables:** researcher profiles, `RTX` ID generation, institutions/departments/affiliations, **ORCID OAuth** (connect/verify/import public info, encrypted tokens), verification levels 0–3, confidence-based identity matching + disambiguation (no auto-merge).
- **Integrations:** ORCID.
- **Exit gate:** researcher can register, get `RTX` ID, connect+verify ORCID, add affiliation; matching never auto-merges below threshold. **STOP FOR REVIEW.**

### Phase 3 — Publication Engine
- **Goal:** publications as first-class graph nodes with clean provenance.
- **Deliverables:** publication entity + public SSR pages (`/publications/{slug}`), DOI validation, **Crossref** + **OpenAlex** import, citation metadata, citation exports (BibTeX/RIS/EndNote/APA/Vancouver/Chicago), PDF handling (upload, checksum, MIME, `pdf_has_text`), dedup + author matching pipeline (Spec §56–58).
- **Integrations:** Crossref, OpenAlex.
- **Exit gate:** import a DOI end-to-end with dedup + matching + provenance; public page renders; exports work. **STOP FOR REVIEW.**

### Phase 4 — OJS Integration
- **Goal:** editorial layer synced without duplication.
- **Deliverables:** OJS adapter with **version inspection first**, capability probe, journal/issue/article/author sync, DOI + PDF/full-text linking, metadata sync, mapping tables, manual + scheduled (+ webhook if available) sync, retry queue, conflict resolution, sync dashboard. OAI-PMH fallback.
- **Integrations:** OJS. *(Blocked on knowing the target OJS install/version — see Risk R1.)*
- **Exit gate:** idempotent sync of a real journal with no duplicates; verified identity never overwritten. **STOP FOR REVIEW.**

### Phase 5 — Google Scholar Optimization
- **Goal:** technical discoverability compliance (never guaranteed indexing).
- **Deliverables:** full `citation_*` meta, schema.org JSON-LD, Dublin Core/OG, canonical + robots, per-type XML sitemaps, public abstract pages, PDF text/size compliance, **Google Scholar Compliance Checker** (admin) + automated test suite (Spec §70).
- **Exit gate:** sample publication passes the checker; test suite green in CI. **STOP FOR REVIEW.**

### Phase 6 — Research Projects & Outputs
- **Goal:** the connectivity graph beyond papers.
- **Deliverables:** projects + teams + statuses, grants/funders, datasets (+ versions, access levels), instruments (+ psychometric metadata, versions), software; output↔everything linking.
- **Exit gate:** a project links outputs/datasets/instruments/software with correct access control. **STOP FOR REVIEW.**

### Phase 7 — Search & Discovery
- **Goal:** fast global search behind a swappable interface.
- **Deliverables:** Postgres FTS + `pg_trgm` behind `SearchIndex`; researcher/publication/institution/topic search; advanced filters (Spec §17); ranking; discovery pages (`/discover`, `/researchers`, `/publications`, …).
- **Exit gate:** sub-second search across core entities with filters; interface documented for future OpenSearch. **STOP FOR REVIEW.**

### Phase 8 — Research Collaboration
- **Goal:** explained matchmaking.
- **Deliverables:** collaborator discovery + researcher matching with **explanations** (Spec §18), collaboration requests, research groups.
- **Exit gate:** every recommendation carries a why; requests + groups work. **STOP FOR REVIEW.**

### Phase 9 — Research Analytics
- **Goal:** honest, bot-filtered analytics.
- **Deliverables:** publication/citation/visibility/engagement/institutional analytics; bot filtering; source-labelled metrics; snapshotting for trends.
- **Exit gate:** analytics distinguish views/downloads/etc., filter bots, label sources. **STOP FOR REVIEW.**

### Phase 10 — RVM
- **Goal:** transparent visibility metric (prototype).
- **Deliverables:** RVM data model, indicator engine, dimension scoring, transparency surfacing, researcher dashboard, institutional RVM, "Improve My Visibility", profile completeness. **Weights NOT finalized without methodological review.**
- **Exit gate:** RVM computes transparently with provisional weights + confidence + missing-data; labelled proprietary/pending validation. **STOP FOR REVIEW.**

### Phase 11 — AI Research Intelligence
- **Goal:** grounded, explained AI assistance.
- **Deliverables:** `AIProvider` abstraction (Claude default), profile summarization, expertise extraction, collaborator/trend/gap discovery, opportunity + visibility recommendations — each **explained and grounded in source records**; no hallucinated publications; no private data to providers without authorization.
- **Exit gate:** AI features cite sources, never fabricate, honor privacy. **STOP FOR REVIEW.**

### Phase 12 — Institutional Platform
- **Goal:** multi-tenant institutional intelligence.
- **Deliverables:** institutional tenants + boundaries, department dashboards, research-office dashboard, institutional RVM, institutional reporting/exports.
- **Exit gate:** tenant isolation verified; no cross-institution private data leakage. **STOP FOR REVIEW.**

### Phase 13 — Opportunities
- **Deliverables:** grants/fellowships/jobs/conferences/CFPs/collaboration opportunities + matching. **STOP FOR REVIEW.**

### Phase 14 — Advanced Scholarly Graph
- **Deliverables:** graph relationships, network/collaboration/topic/citation network analysis; optional graph read-model if analytics demand it. **STOP FOR REVIEW.**

### Phase 15 — Production Hardening
- **Deliverables:** security audit, performance + accessibility testing, DB optimization, API hardening, backup + DR testing, integration testing, pen-test prep. **STOP FOR REVIEW.**

### Phase 16 — Beta
- **Targets:** 50 researchers · 5 groups · 2 institutions · 2 journals · live OJS. Collect feedback.

### Phase 17 — Global Release
- Production infra, docs, onboarding, pricing, support, acquisition.

---

## 3. MVP mapping (Spec §78)

The MVP is delivered across **Phases 1–5, 7, and a Phase-10 RVM prototype**, with admin coverage layered in:

| MVP requirement (Spec §78) | Delivered in |
|---|---|
| Researcher registration, profile, `RTX` ID, institution | Phase 1–2 |
| ORCID | Phase 2 |
| Publication import (DOI/Crossref/OpenAlex) | Phase 3 |
| Publication pages + Google-Scholar-friendly metadata | Phase 3 + 5 |
| OJS integration | Phase 4 |
| Search + researcher discovery | Phase 7 |
| Basic research metrics | Phase 3/9 subset |
| Initial RVM prototype | Phase 10 (prototype scope) |
| Admin dashboard | Incremental (admin surfaces from Phase 1; consolidated by Phase 5) |
| Security, responsive design | Cross-cutting, gated every phase |

Everything beyond this list is explicitly staged (Spec §78).

---

## 4. Risk register

| ID | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| **R1** | **OJS version/API variance** — unknown target install; native REST varies by major version | High | High | Inspect version first; capability probe; strategy pattern; OAI-PMH fallback. **Blocks Phase 4 detail — need the target OJS install/version.** |
| **R2** | **Google Scholar indexing not guaranteed** — compliance ≠ inclusion | High | Medium | Build for compliance + checker; never claim indexing (Spec §83); set expectations in copy. |
| **R3** | **Wrong researcher merges** — identity collisions damage trust | Medium | High | Confidence thresholds; no auto-merge <95%; researcher confirmation; audit trail (Spec §58). |
| **R4** | **RVM perceived as validated** before it is | Medium | High | Label proprietary/pending; provisional weights; separate methodology module (Spec §24). |
| **R5** | **External API rate limits / outages** (Crossref/OpenAlex/ORCID) | Medium | Medium | Caching, polite pools, backoff, retry+DLQ, degrade gracefully. |
| **R6** | **Copyright exposure** from full-text hosting | Medium | High | Rights declaration required; license enforcement; no infringement encouragement (Spec §34). |
| **R7** | **Scope overrun** — 100-section spec vs. delivery capacity | High | High | Strict phase gates; MVP discipline; STOP FOR REVIEW enforced. |
| **R8** | **Metric gaming** (views/citations/RVM) | Medium | Medium | Bot filtering, rate limits, anomaly detection (Spec §65). |
| **R9** | **Multi-tenant data leakage** | Low | High | Central RBAC/ABAC gate; tenant checks in one place; tests in Phase 12 (Spec §49). |
| **R10** | **Secret/token exposure** | Low | High | Env injection, encrypted token storage, never to frontend, secret scanning in CI (Spec §35). |
| **R11** | **PDF quality** (image-only, non-searchable) breaks Scholar | Medium | Medium | Reject image-only at upload; `pdf_has_text` gate; checker (Spec §11). |

---

## 5. Estimated implementation complexity

**Overall: Very High** (global scholarly infrastructure). Relative sizing per area:

| Area | Complexity | Driver |
|---|---|---|
| Foundation (Phase 1) | Medium-High | Monorepo + auth + RBAC + design system done right. |
| Researcher identity + ORCID | High | OAuth, encrypted tokens, matching/disambiguation. |
| Publication engine + Crossref/OpenAlex | High | Dedup, matching, provenance, exports, PDF handling. |
| **OJS integration** | **Very High** | Version variance, sync idempotency, conflict resolution. |
| Google Scholar compliance | Medium-High | Metadata correctness + checker + PDF text validation. |
| Search & discovery | High | FTS + fuzzy + ranking behind swappable interface. |
| **RVM engine** | **Very High** | Configurable, transparent, versioned, fair, anti-gamed. |
| AI intelligence | High | Provider abstraction + grounding + privacy. |
| Institutional multi-tenancy | High | Isolation guarantees + reporting. |
| Scholarly graph analytics | High | Recursive queries / optional graph store. |
| Hardening | High | Security/perf/a11y/DR at scale. |

**Highest-risk, highest-effort:** OJS integration, RVM engine, scholarly graph + search, Google Scholar compliance (matches Spec §17 summary).

---

## 6. Cross-cutting workstreams (every phase)

Security · accessibility (WCAG 2.2 AA) · responsive · i18n scaffolding · observability · testing · documentation · provenance & audit. These are not phases — they are gates applied to *all* phases (Spec §97).

---

## 7. Immediate next step

**Do not implement Phase 1** until: (a) these five documents are reviewed, and (b) the five open decisions in [`MASTER-ARCHITECTURE.md` §Open decisions](./MASTER-ARCHITECTURE.md) are resolved — especially the **OJS target environment** (R1), which shapes Phase 4.
