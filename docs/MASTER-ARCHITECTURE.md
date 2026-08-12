# ResearchTrics — Master Architecture

> **Status:** Phase 0 (Discovery & Architecture) — *Draft for review*
> **Product:** ResearchTrics — Global Research Visibility Infrastructure
> **Core metric:** Research Visibility Metric (RVM)
> **Tagline:** Make Research Visible. Discoverable. Connected. Measurable.

This document is the top-level architecture reference. It is deliberately technology-opinionated but implementation-deferred: nothing here is built yet. Companion documents:

- [`ROADMAP.md`](./ROADMAP.md) — phased delivery plan, risk register, complexity.
- [`DATABASE-ARCHITECTURE.md`](./DATABASE-ARCHITECTURE.md) — ERD, tables, provenance model.
- [`INTEGRATION-ARCHITECTURE.md`](./INTEGRATION-ARCHITECTURE.md) — ORCID, Crossref, OpenAlex, OJS, Google Scholar.
- [`RVM-FRAMEWORK.md`](./RVM-FRAMEWORK.md) — the visibility measurement framework and its scoring engine.

---

## 1. Current repository assessment

| Item | Finding |
|---|---|
| Repository state | **Empty** (no source, no VCS history, no dependencies) |
| Git | Not initialized |
| Existing architecture | None |
| Existing dependencies | None |
| Implication | Greenfield. No legacy to preserve; every "never destroy working functionality" constraint is forward-looking. |

**Recommended first infra action (Phase 1, not now):** `git init`, establish monorepo, commit `.env.example` + docs. No secrets ever committed.

---

## 2. Architectural principles (non-negotiable)

These derive directly from the specification and constrain every later decision.

1. **Identity is internal and authoritative.** Every researcher gets a persistent `RTX-XXXXXXXX` ID. External IDs (ORCID, OpenAlex, Scopus, WoS, Scholar) are *mappings*, never the primary key. No external source blindly overwrites verified internal data (Spec §85).
2. **Provenance on everything imported.** Every externally sourced record stores `source`, `source_id`, `retrieved_at`, `last_synced_at`, `confidence`, raw + normalized metadata (Spec §84).
3. **No isolated PDFs.** Every output is a graph node connectable to researcher, institution, project, dataset, instrument, funder, citation (Spec §1).
4. **Trust labelling.** The UI and data model always distinguish *verified fact* vs *external metadata* vs *researcher-provided* vs *AI-generated* vs *platform-computed* (Spec §64).
5. **Transparency of metrics.** RVM is never a black box; raw values, normalization, weights, missing data, and confidence are always inspectable (Spec §23).
6. **Idempotent interoperability.** All sync/import is idempotent, keyed on external IDs, dedup-aware, audit-logged (Spec §12, §56, §57).
7. **Public scholarly content is crawlable without login.** Abstracts and landing pages are server-rendered and open to Google Scholar / Googlebot (Spec §11).
8. **Phased, reversible, auditable.** Scholarly records are never silently mutated; history is retained (Spec §59, §68).

---

## 3. Technology stack recommendation

Chosen for a **10–20 year infrastructure horizon**: boring, mature, portable, self-hostable, no lock-in to a single cloud.

### 3.1 Core stack

| Concern | Choice | Rationale |
|---|---|---|
| Language | **TypeScript (strict)** end to end | Spec §94; one language across web + workers + shared domain packages. |
| Web framework | **Next.js (App Router)** | SSR/SSG is mandatory for Google Scholar discoverability (Spec §11, §42). Server Components reduce client JS. Route handlers give us `/api/v1/*`. |
| UI | **React + Tailwind CSS + Radix UI primitives** | Radix = accessible unstyled primitives (WCAG 2.2 AA, Spec §51); Tailwind wired to brand tokens (Spec §96) so raw colors never scatter. |
| ORM / DB toolkit | **Prisma** (schema + migrations) with **raw SQL** escape hatch for graph/analytics | Strong typed schema + migration DX for a large normalized model; raw SQL for recursive graph and metric aggregation queries where Prisma is weak. |
| Database | **PostgreSQL 16+** | Spec §44. FTS for MVP search, `pg_trgm` for fuzzy match/dedup, JSONB for raw provenance payloads, partitioning-ready for metric snapshots. |
| Cache / queue backend | **Redis** | Rate-limit buckets, response cache, BullMQ backend. |
| Background jobs | **BullMQ** (Redis) | Mature, observable, DLQ, retries, scheduled + event jobs (Spec §73). *Alternative considered: `pg-boss` (fewer moving parts, Postgres-only) — kept as fallback if Redis ops burden is unwanted.* |
| Object storage | **S3-compatible** — MinIO (self-host) / Cloudflare R2 / AWS S3 | Signed URLs for restricted files; never store PDFs in Postgres (Spec §46). |
| Auth | **Auth.js (NextAuth v5)** for OAuth plumbing + **custom DB sessions & RBAC layer** | ORCID is a custom OAuth provider; we need our own verification-level, encrypted-token, and RBAC model on top. |
| Email | **Provider abstraction** + **React Email** templates; default adapter Resend/Postmark/SES | Spec §40, §48-style abstraction so provider is swappable. |
| AI | **Provider abstraction** (`AIProvider` → `ClaudeProvider` default, `OpenAIProvider`, …) | Spec §48. Structured outputs, token budgeting, caching, no private data without authorization. |
| Search | **PostgreSQL FTS** behind a `SearchIndex` interface → future **OpenSearch** | Spec §17, §47. Abstraction lets us swap engines without touching callers. |
| Validation | **Zod** | Runtime schema validation at every trust boundary (API input, external payloads). |
| Testing | **Vitest** (unit/integration), **Playwright** (E2E + a11y), **supertest-style** API tests | Spec §69, §70. |
| i18n | **next-intl** (or `i18next`) with message catalogs | Spec §50; no hard-coded UI strings. |
| Observability | **Pino** structured logs + **OpenTelemetry** traces + **Sentry** errors | Spec §72. |
| Containerization | **Docker + docker-compose** (dev), Kubernetes-ready | Spec §75. |

### 3.2 Why not alternatives (brief)

- **Not** a separate SPA + standalone REST backend: doubles the identity/session surface and loses SSR-for-Scholar. Next.js route handlers *are* the API layer, versioned under `/api/v1`.
- **Not** Drizzle as primary (kept in mind): Prisma's migration + relation ergonomics win for a schema this large; we still drop to SQL where needed.
- **Not** Elasticsearch on day one: Spec §47 explicitly says don't add it prematurely — hide it behind an interface instead.
- **Not** a graph database (Neo4j) for MVP: the scholarly graph (Spec §16) is modeled as normalized relational edges; recursive CTEs cover MVP graph analytics. A graph store becomes an *optional read-model* in Phase 14 if analytics demand it.

---

## 4. System topology

```
                          ┌────────────────────────────────────────────┐
                          │              Clients                        │
                          │  Browser · Google Scholar/Googlebot · API   │
                          └───────────────┬────────────────────────────┘
                                          │ HTTPS
                    ┌─────────────────────▼─────────────────────┐
                    │        Next.js (App Router) — apps/web      │
                    │  SSR public pages (Scholar-crawlable)       │
                    │  Authenticated dashboards                   │
                    │  /api/v1/* route handlers (REST, versioned) │
                    └───┬───────────────┬───────────────┬────────┘
                        │               │               │
         reads/writes   │        enqueue│ jobs   cache/ │ ratelimit
                        ▼               ▼               ▼
                ┌──────────────┐  ┌───────────┐  ┌───────────┐
                │ PostgreSQL   │  │  Redis    │  │  Redis    │
                │ (authoritative│  │ (BullMQ)  │  │ (cache)   │
                │  + provenance)│  └─────┬─────┘  └───────────┘
                └──────┬───────┘        │
                       │                ▼
                       │        ┌───────────────────────────┐
                       │        │   Worker — apps/worker      │
                       │        │  OJS/ORCID/Crossref/OpenAlex│
                       │        │  citation upd · PDF extract │
                       │        │  RVM calc · AI · analytics  │
                       │        │  email · notifications      │
                       │        └───────┬───────────────┬────┘
                       │                │               │
                       ▼                ▼               ▼
                ┌──────────────┐  ┌───────────┐  ┌──────────────────────┐
                │ Object store │  │ AI/Email  │  │ External scholarly    │
                │ (S3/MinIO)   │  │ providers │  │ APIs (ORCID/Crossref/ │
                └──────────────┘  └───────────┘  │ OpenAlex/OJS/DataCite)│
                                                 └──────────────────────┘
```

**Separation of duties (Spec §43, §75):** the web tier never runs expensive work synchronously. Imports, sync, citation updates, PDF text extraction, RVM computation, AI, analytics aggregation, and email all run in the worker via queues.

---

## 5. Repository structure (monorepo)

**pnpm workspaces + Turborepo.** Shared domain logic lives in packages so web and worker cannot drift.

```
researchtrics/
├── apps/
│   ├── web/                 # Next.js: public SSR pages, dashboards, /api/v1
│   └── worker/              # BullMQ processors (sync, import, RVM, AI, email)
├── packages/
│   ├── db/                  # Prisma schema, migrations, typed client, seed
│   ├── core/                # Domain services (identity, publications, RVM, RBAC)
│   ├── integrations/        # ORCID, Crossref, OpenAlex, OJS, DataCite adapters
│   │   ├── orcid/
│   │   ├── crossref/
│   │   ├── openalex/
│   │   ├── ojs/
│   │   └── shared/          # HTTP client, rate limiter, cache, provenance helper
│   ├── ai/                  # AIProvider abstraction + Claude/OpenAI adapters
│   ├── search/              # SearchIndex interface + Postgres impl
│   ├── ui/                  # Design system components (Spec §5)
│   ├── config/              # Brand tokens, env schema (Zod), constants
│   └── contracts/           # Zod schemas + shared TS types (API + domain)
├── docs/                    # This documentation set
├── docker/                  # Dockerfiles, compose, MinIO/OJS local stack
├── .env.example
├── turbo.json
└── package.json
```

**Rule:** integration adapters expose a stable domain-shaped interface; callers never see raw Crossref/OpenAlex JSON. Swapping or versioning an external API is contained inside its adapter (Spec §85, §86).

---

## 6. Domain model (conceptual)

The relationship spine (Spec §1, §16) — full schema in [`DATABASE-ARCHITECTURE.md`](./DATABASE-ARCHITECTURE.md):

```
Researcher ──authored──▶ Publication ──cites──▶ Publication
    │                        │
    │ affiliated_with        ├─ uses ─▶ Dataset
    ▼                        ├─ uses ─▶ Instrument
Institution ◀─part_of─ Dept  ├─ generated_by ─▶ Project
    │                        ├─ funded_by ─▶ Funder/Grant
    │ member_of              └─ published_in ─▶ Journal
    ▼
Research Group        Researcher ──collaborates_with──▶ Researcher
```

Nodes: Researcher, Publication, Institution, Department, Project, Dataset, Instrument, Software, Journal, Funder, Grant, ResearchGroup, Topic, Opportunity.
Edges: AUTHORED, COAUTHORED, AFFILIATED_WITH, MEMBER_OF, PART_OF, CITES, USES_DATASET, USES_INSTRUMENT, USES_SOFTWARE, FUNDED_BY, PUBLISHED_IN, RELATED_TO, COLLABORATES_WITH, SUPERVISED_BY, SUPPORTED_BY, TRANSLATED_INTO, REUSED_BY.

---

## 7. Authorization model (RBAC → ABAC-ready)

**RBAC now, ABAC-capable later (Spec §6).**

- **Principals:** User accounts; a user may hold multiple **roles** scoped to a **context** (global, institution, department, research group, journal).
- **Roles (Spec §6):** researcher, student_researcher, research_assistant, research_group_admin, institution_admin, department_admin, journal_editor, publisher_admin, reviewer, research_administrator, funder, employer, platform_admin, super_admin.
- **Enforcement:** central `authorize(actor, action, resource)` in `packages/core`. Every API route and server action passes through it. Multi-tenancy boundary (Spec §49) is enforced here — an institution principal can never read another tenant's private data.
- **ABAC seam:** the policy function receives resource attributes (visibility level, owner, tenant, embargo, verification level), so attribute rules can be layered without changing call sites.
- **Verification levels (Spec §38):** 0 unverified → 1 email → 2 institution → 3 ORCID → 4 output-verified → 5 professional. Levels gate *capabilities* (e.g., claiming outputs, appearing in verified search) and drive badges that are honestly labelled.

---

## 8. API architecture

- **REST, versioned** at `/api/v1/*` (Spec §45). Resource collections mirror Spec §45 (`researchers`, `publications`, `institutions`, `projects`, `datasets`, `instruments`, `software`, `journals`, `research-groups`, `opportunities`, `search`, `metrics`, `rvm`, `integrations/*`).
- **Contracts** in `packages/contracts` (Zod) are the single source of truth for request/response shapes; used for validation *and* type generation.
- **Auth:** session cookie (first-party UI) or API key / OAuth (external systems, Spec §67) with per-key quotas.
- **Errors:** centralized problem-shape (`{ error: { code, message, details, traceId } }`), never leaking internals.
- **Pagination:** cursor-based for large collections (Spec §43).
- **GraphQL:** explicitly deferred; REST contracts are designed to not preclude it.

---

## 9. Integration architecture (summary)

Full detail in [`INTEGRATION-ARCHITECTURE.md`](./INTEGRATION-ARCHITECTURE.md). Each adapter: typed client, rate limiter, cache, retry, provenance writer, idempotent upsert keyed on external IDs.

| Integration | Role | Authority stance |
|---|---|---|
| **ORCID** (OAuth) | Verify identity, import works with consent, encrypted token storage | Authoritative for *identity verification*; researcher confirms imports. |
| **Crossref** (REST) | DOI → metadata, references, funding, license | Highest priority for *publication metadata* (Spec §85). Polite pool, cache, no repeat lookups. |
| **OpenAlex** (REST) | Discovery, citations, topics, related works | Discovery/enrichment only — **never** authoritative for identity. |
| **OJS** (adapter) | Journals/editorial layer; sync journals, issues, articles, authors, DOIs, PDFs | Version-inspected first; mapping tables; never overwrites verified researcher identity. |
| **DataCite** (future) | Dataset/instrument/software DOI registration | Legitimate PID minting only — never invent DOIs (Spec §61, §98). |
| **Google Scholar** | Discoverability *target*, not an API | Compliance via metadata + crawlable pages + checker; indexing never *guaranteed* (Spec §11, §83). |

---

## 10. Google Scholar indexing architecture (summary)

Detail in [`INTEGRATION-ARCHITECTURE.md` §Google Scholar](./INTEGRATION-ARCHITECTURE.md). Core commitments:

- One publication = one canonical, unique, **server-rendered** URL (`/publications/{slug}`).
- Highwire `citation_*` meta tags + `schema.org/ScholarlyArticle` JSON-LD + Dublin Core + OpenGraph.
- Public abstract (and full text where licensed) with **no login wall**.
- Searchable-text PDFs via signed/canonical `citation_pdf_url`; image-only PDFs rejected at upload.
- Per-type XML sitemaps; `robots.txt` allows scholarly crawlers; canonical links prevent duplicate URLs.
- **Admin Google Scholar Compliance Checker** (Spec §11, §70) grading each publication PASS / WARNING / FAIL across the full checklist.

---

## 11. RVM architecture (summary)

Detail in [`RVM-FRAMEWORK.md`](./RVM-FRAMEWORK.md). Key stances:

- RVM is a **configurable, transparent measurement framework**, not a fixed magic number.
- 10 dimensions (Discoverability, Accessibility, Engagement, Citation Influence, Collaboration Reach, Research Connectivity, Open Science, Knowledge Translation, International Reach, Digital Presence).
- Data model: `rvm_indicators` → `rvm_dimensions` → `rvm_scores`, with versioned, snapshotted, weight-configurable computation in the worker.
- **Weights are NOT finalized** and are labelled a *proprietary framework pending empirical validation* (Spec §24). A separate methodology module supports future reliability/EFA/CFA/validity work.
- RVM separates **Visibility ≠ Impact ≠ Quality** in both data and copy. Anti-gaming (Spec §65) via rate limiting, bot filtering, anomaly detection.

---

## 12. Security architecture (summary)

Spec §35–36. Full controls tracked in future `SECURITY.md`.

- **AuthN:** Argon2id password hashing, OAuth (ORCID), MFA-ready schema, secure/HttpOnly/SameSite cookies, server-side sessions with rotation.
- **AuthZ:** central RBAC/ABAC gate; tenant isolation; visibility levels (Public / Researchers / Institution / Private) enforced server-side, never client-trusted.
- **Secrets & tokens:** env-injected; OAuth/access tokens **encrypted at rest** (envelope encryption), never sent to the frontend.
- **Input & transport:** Zod validation everywhere, parameterized queries (no string SQL), CSRF tokens on mutations, output encoding + CSP for XSS, HTTPS-only.
- **Uploads:** MIME sniffing + extension allowlist, size caps, checksum, malware-scan hook in the pipeline, quarantine before publish.
- **Abuse:** Redis rate limiting, bot detection, anomaly detection feeding RVM anti-gaming.
- **Audit:** append-only `audit_logs` for identity changes, claims, edits, verification, RVM config, admin actions, sync, imports (Spec §68). No silent destructive edits to scholarly records.
- **Privacy:** field-level visibility controls; account export + deletion (Spec §36); no cross-source personal-data compilation from untrusted instructions.

---

## 13. Deployment architecture (summary)

Spec §75. Detail in future `DEPLOYMENT.md`.

- Independently deployable containers: `web`, `worker`, `postgres`, `redis`, object storage (MinIO), and `ojs` (its own PHP/MySQL stack, integrated over API — never merged into ours).
- Config purely via env vars; `.env.example` committed, secrets never.
- Health endpoints per service; migrations run as a gated deploy step.
- Backups (Spec §74): scheduled Postgres dumps + object-store replication + config backup, encrypted, retained, with restore drills documented.

---

## 14. UI/UX & design system (summary)

Spec §2–5, §80–82.

- **Brand:** dominant ResearchTrics Blue, white surfaces, **gold as restrained accent** for RVM/premium/key metrics only. Tokens centralized in `packages/config` (Spec §96) and consumed via Tailwind theme — no raw hex in components.
- **Type:** Inter with system fallback; restrained weight hierarchy; large numeric type for metrics.
- **Design system first** (Spec §5): build the full component library in `packages/ui` (buttons, inputs, tables, cards, chips, badges — including DOI/ORCID/verification/open-access — RVM score card, empty/loading/error states) *before* complex pages.
- **Accessibility:** WCAG 2.2 AA target, keyboard nav, ARIA, focus management, accessible charts, never color-alone signalling (Spec §51).
- **Charts:** line/bar/area/network/heatmap/sparkline only; no 3D, pie only when necessary (Spec §80). Charts must answer a question.
- **Responsive:** mobile-first profiles, genuine layouts per breakpoint — not shrunk desktop (Spec §52).
- **Voice:** scholarly, no marketing overreach; never "guaranteed indexing/citations" (Spec §83).

---

## 15. Phase roadmap (summary)

Full plan, gates, and criteria in [`ROADMAP.md`](./ROADMAP.md). Seventeen phases (0–17) plus MVP definition; every phase ends with **STOP FOR REVIEW** and cannot start until the prior phase meets completion criteria (Spec §97).

---

## 16. Risk register (summary)

Full register in [`ROADMAP.md`](./ROADMAP.md). Top risks: OJS version/API variance; Google Scholar indexing being non-guaranteed; researcher-identity mismatched merges; RVM appearing "validated" prematurely; external API rate limits/outages; PDF/full-text copyright exposure; scope (100-section spec) vs. disciplined phasing.

---

## 17. Estimated implementation complexity (summary)

Full breakdown in [`ROADMAP.md`](./ROADMAP.md). Headline: **Very High** overall; MVP (Spec §78) is a **Large** effort concentrated in Phases 1–5 + 7 + 10 (prototype). Highest-complexity components: OJS integration, RVM engine, scholarly graph + search, Google Scholar compliance.

---

## 18. MVP definition (summary)

Per Spec §78, the MVP is: researcher registration + profile + `RTX` ID; institution & ORCID; publication import (DOI/Crossref/OpenAlex) with dedup + matching; publication pages with Google-Scholar-friendly metadata; OJS integration; search + researcher discovery; basic metrics + **RVM prototype**; admin dashboard; security; responsive design. Everything else is staged. Full mapping to phases in [`ROADMAP.md`](./ROADMAP.md).

---

## Open decisions — RESOLVED (review sign-off 2026-08-11)

1. **ORM:** ✅ **Prisma** + raw SQL escape hatch. *(Approved.)*
2. **Jobs:** ✅ **BullMQ + Redis**. *(Approved.)*
3. **Auth:** ✅ **Auth.js for OAuth + custom session/RBAC**. *(Approved.)*
4. **Hosting:** ✅ **Self-hosted / Docker** — full stack incl. MinIO (object storage) and self-hosted OJS. Cloud-agnostic via env vars.
5. **OJS environment:** ✅ **Provision fresh OJS** (latest stable) in the Docker stack; Phase 4 adapter built against it (still version-inspected at runtime per §12).

**Decision:** proceed to Phase 1 (Foundation) after this review. Stack approved as recommended.
