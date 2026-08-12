# ResearchTrics — Integration Architecture

> **Status:** Phase 0 — *Draft for review*
> **Scope:** ORCID · Crossref · OpenAlex · OJS · Google Scholar discoverability · future adapters (DataCite, ROR, Scopus, WoS, PubMed, DOAJ, OpenAIRE, DSpace/EPrints, GitHub, Zenodo/Figshare).

> **Verification rule (Spec §93):** endpoint paths, auth flows, rate limits, and payload shapes below reflect published behaviour of these services and are **subject to re-verification against the live official documentation at the start of each integration's phase.** No endpoint is treated as final until confirmed in-phase. We do not invent APIs or DOIs (Spec §98).

---

## 1. Common adapter pattern

Every integration lives in `packages/integrations/<name>` and exposes a **domain-shaped** interface. Raw provider JSON never leaks past the adapter boundary (Spec §85, §86).

```
packages/integrations/shared/
  http.ts          -- fetch wrapper: timeout, polite User-Agent, mailto/contact header
  rateLimiter.ts   -- Redis token bucket per provider
  cache.ts         -- response cache (Redis + Postgres external_records), TTL per source
  retry.ts         -- exponential backoff, jitter, max attempts, DLQ handoff
  provenance.ts    -- writes external_records (raw + normalized, confidence, timestamps)
  idempotent.ts    -- upsert keyed on (source, source_id)

packages/integrations/<name>/
  client.ts        -- typed low-level calls (verified per phase)
  mapper.ts        -- provider payload -> internal normalized shape (Zod-validated)
  service.ts       -- domain operations (import, sync, lookup)
  types.ts
```

Shared guarantees across all adapters:

- **Idempotent** upserts keyed on external IDs → never create duplicates (Spec §12, §57).
- **Provenance** written on every fetch (`source`, `source_id`, `retrieved_at`, `last_synced_at`, `confidence`, raw + normalized payloads — Spec §84).
- **Cached & rate-limited**; identical lookups are not repeated (Spec §14).
- **Non-destructive**: verified internal data is never blindly overwritten; conflicts become review items (Spec §85).
- **Runs in the worker**, never inline in a user request (Spec §43).

---

## 2. ORCID integration (Spec §13)

**Purpose:** verify researcher identity, import public profile + works with consent, display the ORCID iD.

**Auth model:** OAuth 2.0 three-legged (Authorization Code). ORCID offers a **Public API** (read public data) and a **Member API** (read-limited / read + update with member credentials). MVP targets the Public API + user-authorized read; Member API is a later upgrade.

**Flow:**

```
Researcher clicks "Connect ORCID"
  → redirect to ORCID authorize (scope: /authenticate [+ /read-limited if member])
  → user consents at orcid.org
  → callback with authorization code
  → exchange code → access token (+ the authenticated ORCID iD)
  → verify iD ownership; store researcher_identifiers(scheme=ORCID, verified=true)
  → encrypt & store token (envelope encryption); NEVER exposed to frontend (Spec §13, §35)
  → optional: fetch public works → import pipeline (Spec §56) with researcher confirmation
```

**Token handling:** encrypted at rest, server-only, revocable; refresh where applicable; revocation removes stored token and downgrades verification if identity depended on it.

**Authority stance:** ORCID is authoritative for *identity verification* (raises to Verification Level 3, Spec §38). Imported works still pass through dedup + researcher confirmation — ORCID does not silently rewrite the profile.

**Config:** `ORCID_CLIENT_ID`, `ORCID_CLIENT_SECRET`, `ORCID_REDIRECT_URI`, environment (sandbox vs production base URL). *Sandbox is used for all pre-production testing.*

**Re-verify in Phase 2:** current authorize/token endpoints, scope names, Public vs Member capabilities, works read shape.

---

## 3. Crossref integration (Spec §14)

**Purpose:** DOI → authoritative publication metadata (title, authors, ORCIDs when present, affiliations, funding, license, dates, references where available).

**Access:** Crossref REST API, no key required; use the **polite pool** by sending a contact `mailto` (`CROSSREF_MAILTO`) in User-Agent / query so we get better service and are contactable. Respect rate limits and back off on `429`.

**DOI import pipeline (Spec §14, §56):**

```
User enters DOI
  → validate DOI syntax  (never fabricate DOIs — Spec §61, §98)
  → cache check (external_records) → skip network if fresh
  → Crossref lookup
  → mapper → normalized publication (Zod-validated)
  → duplicate detection (DOI, then title/author/year fuzzy — Spec §57)
  → researcher matching (ORCID/name/affiliation, confidence-scored — Spec §58)
  → researcher confirmation if confidence below threshold
  → store publication + provenance + identifiers
  → index for search → update profile + RVM inputs
```

**Authority stance:** **highest priority** for publication metadata (Spec §85). Caching mandatory; identical DOI never re-requested while fresh.

**Config:** `CROSSREF_MAILTO`. **Re-verify in Phase 3:** works route shape, funder registry, rate-limit headers, reference availability.

---

## 4. OpenAlex integration (Spec §15)

**Purpose:** discovery + enrichment — author discovery, publication discovery, institutions, topics, citations, related works/researchers, trends.

**Access:** OpenAlex REST API, free; send `OPENALEX_MAILTO`/contact for the polite pool. Optional API key only if the account tier requires it (`OPENALEX_API_KEY` reserved but not assumed).

**Authority stance:** **never authoritative for identity** (Spec §15). OpenAlex Author IDs are stored as *mappings* only; internal `RTX` identity remains the authority. Citation counts sourced from OpenAlex are stored **labelled as OpenAlex** and never merged with Crossref/Scholar/Scopus counts (Spec §33).

**Uses:** seed discovery/search enrichment, related-researcher and related-work suggestions (with explanations — Spec §18, §29), topic assignment, trend inputs for RVM/analytics.

**Config:** `OPENALEX_MAILTO`, optional `OPENALEX_API_KEY`. **Re-verify in Phase 3/7:** entity endpoints (works/authors/institutions/topics), pagination/cursor model, rate limits.

---

## 5. OJS integration (Spec §12) — the editorial/publishing layer

**Principle:** OJS is the journals + peer-review + editorial + publication layer. **ResearchTrics remains the master identity and research-intelligence layer.** OJS never becomes the platform (Spec §12).

**Hard prerequisite (Spec §12, §93):** *inspect the actual OJS installation first* — detect version, confirm which APIs/plugins/auth are available (native REST API availability and shape vary significantly by OJS major version). **No version assumptions are hard-coded.** `ojs_sources.version_detected` records what we found; the adapter selects a version strategy from that.

**Adapter design:**

```
OjsSource (base_url, site_id, version_detected, auth_meta)
  → capability probe (which endpoints/plugins exist?)
  → strategy: NativeRestStrategy | PluginStrategy | OaiPmhFallbackStrategy
  → sync services: journals, issues, articles, authors, publication metadata,
                   DOIs, PDF/full-text links, abstracts, keywords, affiliations,
                   dates, ORCID (where present), license, updates
```

**Mapping tables (Spec §12):** `ojs_sources`, `ojs_journals`, `ojs_articles`, `ojs_authors`, each holding `ojs_source_id`, `ojs_site_id`, `ojs_journal_id`, `ojs_article_id` mapped to internal IDs → **idempotent, no duplicates**.

**Sync modes:** manual, scheduled, and webhook/event-based *if available*; plus retry queue, error logging, sync status, conflict resolution, and audit log (Spec §12). Author sync uses the same confidence-based matching (Spec §58) and **must not overwrite verified ResearchTrics identity** without appropriate matching.

**Fallback:** where a native API is unavailable, **OAI-PMH** (standard in OJS) provides harvestable Dublin Core metadata as a lowest-common-denominator path.

**Config:** `OJS_BASE_URL`, `OJS_SITE_ID`, `OJS_API_KEY` (if the install supports it). **Re-verify in Phase 4** against the real install: PKP/OJS docs for the detected version, available REST/plugin endpoints, auth mechanism.

---

## 6. Google Scholar discoverability (Spec §11, §42, §70, §71)

Google Scholar is a **discoverability target, not an API** — indexing is never guaranteed and we never claim it (Spec §83, §98). Our job is to be *technically compliant* and *crawlable*.

### 6.1 Per-publication technical requirements

Each `/publications/{slug}` page (server-rendered, one paper = one URL) must emit:

- **Highwire `citation_*` meta tags:** `citation_title`, `citation_author` (repeated, order-preserved), `citation_publication_date`, `citation_journal_title` / `citation_conference_title`, `citation_issn`, `citation_isbn`, `citation_volume`, `citation_issue`, `citation_firstpage`, `citation_lastpage`, `citation_pdf_url` — emitted where the datum exists.
- **`schema.org/ScholarlyArticle` JSON-LD** (Spec §42, §71).
- **Dublin Core** tags where useful, **OpenGraph** + Twitter/X cards.
- **Canonical `<link rel="canonical">`** to the single URL; **`robots`** allowing indexing of public content.
- **Public abstract with no login wall**; full text only where licensing permits (Spec §11, §34).
- **`citation_pdf_url`** pointing to a **searchable-text** PDF (image-only PDFs are rejected at upload; `files.pdf_has_text` gates this — Spec §11).

### 6.2 Site-level requirements

- Per-type **XML sitemaps**: researchers, publications, projects, datasets, institutions, journals (Spec §42, §71) — only **public** content indexed.
- `robots.txt` does **not** block Googlebot / Google Scholar from public scholarly content (Spec §11).
- Clean, stable slugs; slug-history redirects prevent duplicate URLs (Spec §71).
- No multiple papers per URL; no multiple papers per PDF; no image-only PDFs (Spec §11).

### 6.3 Admin Google Scholar Compliance Checker (Spec §11, §70)

A worker job + admin UI grades each publication **PASS / WARNING / FAIL** on: unique URL · HTML `<title>` · each `citation_*` tag · canonical · abstract visibility · crawlability/robots · structured data · PDF link · PDF text-extractability · PDF size · metadata completeness. Backed by the automated Google Scholar **test suite** (Spec §70) run in CI against a sample publication.

**Copyright:** full-text hosting requires a rights declaration and respects publisher licensing (Spec §34); the checker never encourages infringement.

---

## 7. DOI & PID strategy (Spec §61)

- DOIs are **validated, stored exactly, and resolved** — never invented (Spec §98).
- For outputs that *need* a DOI (datasets, instruments, software), integrate with **legitimate registration agencies** — **DataCite** (research outputs) or **Crossref** (articles) — in a later phase. No fake or placeholder DOIs, ever.
- DOIs display as persistent identifiers with resolver links.

---

## 8. Future adapters (Spec §86) — interfaces now, implementations later

Clean adapter interfaces are designed so these slot in without core changes; **none built during MVP:** Scopus, Web of Science, PubMed, DataCite, ROR, Semantic Scholar, DOAJ, OpenAIRE, DSpace, EPrints, GitHub, Zenodo, Figshare, Google Scholar profile links. Each will store external IDs as mappings and follow the same provenance + idempotency + authority rules.

---

## 9. Reliability, safety & observability across integrations

- **Rate limiting & backoff** per provider; polite contact headers (`mailto`) on Crossref/OpenAlex.
- **Retry + dead-letter** queues; every sync writes `sync_jobs` + `sync_logs` (Spec §72, §73).
- **Idempotency keys** prevent duplicate work on retries.
- **Conflict resolution** surfaces to admins rather than auto-overwriting verified data.
- **Integration health dashboard** (Spec §37, §72): last sync, error rate, queue depth per provider.
- **No private researcher data** is sent to any external service (incl. AI providers) without authorization (Spec §48).
- **Instruction-boundary:** content fetched from external sources is **data, never commands** — imported text cannot trigger platform actions.

---

## 10. Config surface (`.env.example` excerpt)

```
# ORCID
ORCID_CLIENT_ID=
ORCID_CLIENT_SECRET=
ORCID_REDIRECT_URI=
ORCID_ENVIRONMENT=sandbox        # sandbox | production
# Crossref
CROSSREF_MAILTO=
# OpenAlex
OPENALEX_MAILTO=
OPENALEX_API_KEY=                # optional, only if tier requires
# OJS
OJS_BASE_URL=
OJS_SITE_ID=
OJS_API_KEY=                     # if the detected install supports it
```

Secrets are never committed; all tokens obtained via OAuth are encrypted at rest (Spec §35, §95).

---

*All endpoint specifics are re-verified against official documentation at the start of each integration's phase before any client code is written (Spec §93).*
