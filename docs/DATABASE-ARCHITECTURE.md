# ResearchTrics — Database Architecture

> **Status:** Phase 0 — *Draft for review*
> **Engine:** PostgreSQL 16+ · **Toolkit:** Prisma (schema/migrations) + raw SQL for graph/analytics.

Design goals (Spec §44): normalized relational model, foreign keys, strategic indexes, unique constraints, soft deletion where appropriate, UUIDs where appropriate, external IDs for scholarly identifiers, and **provenance on every imported record** (Spec §84). Avoid premature denormalization; snapshot tables carry precomputed metrics.

---

## 1. Identifier strategy

| Use | Type | Notes |
|---|---|---|
| Primary keys | `uuid` (v7 preferred, time-ordered) | Global uniqueness, safe to expose in APIs, index-friendly ordering. |
| Public researcher identity | `researchtrics_id` = `RTX-00000001` | Human-facing, **persistent**, never the email (Spec §7). Zero-padded sequence + `RTX-` prefix. |
| Public output identity | per-output persistent internal ID (Spec §9) | e.g. `RTP-…` publications, `RTD-…` datasets, `RTI-…` instruments. |
| Public URLs | `slug` (unique, immutable once indexed) | One paper = one slug = one URL (Spec §10, §11). Slug history table preserves redirects. |
| External scholarly IDs | stored as typed rows in `*_identifiers` | DOI, ORCID, OpenAlex, Scopus, WoS, PMID, ISSN, ISBN, ROR (Spec §7, §15, §85). |

---

## 2. Entity-Relationship Diagram (conceptual)

```
                                   ┌───────────────┐
                                   │     users     │  (auth principal; NOT identity)
                                   └───────┬───────┘
                                           │ 1:1 (optional)
                                   ┌───────▼────────┐        ┌─────────────────────────┐
              ┌────────────────────│  researchers   │───────▶│ researcher_identifiers  │ (ORCID, OpenAlex, Scopus…)
              │                    │ (RTX-ID, ident.)│        └─────────────────────────┘
              │                    └───┬───────┬────┘        ┌─────────────────────────┐
              │                        │       │────────────▶│ researcher_name_variants│
              │                        │       │             └─────────────────────────┘
     affiliations (M:N,               │       │ member_of (M:N)
      time-bounded, verified)         │       └───────────────────┐
              │                       │ authored (M:N via         ▼
     ┌────────▼────────┐              │  publication_authors)  ┌──────────────────┐
     │  institutions   │◀──part_of── │                        │ research_groups  │
     │  (ROR, tenant)  │  departments│                        └──────────────────┘
     └────────┬────────┘             │
              │ part_of              ▼
     ┌────────▼────────┐   ┌───────────────────────┐        ┌───────────────────────┐
     │  departments    │   │     publications      │───────▶│ publication_identifiers│ (DOI, PMID…)
     └─────────────────┘   │ (slug, RTP-ID, type)  │        └───────────────────────┘
                           └──┬─────┬─────┬────┬────┘        ┌───────────────────────┐
                    cites (self│     │     │    │───────────▶│ publication_authors    │─▶ researchers
                     M:N)◀─────┘     │     │    │            │ (ordered, affil, role) │
                                     │     │    │            └───────────────────────┘
                   published_in ┌────▼─┐   │    │ funded_by
                                │journals│  │    └──────────┐
                                │(ISSN)  │  │ generated_by  ▼
                                └────────┘  │           ┌────────┐   ┌─────────┐
                                            ▼           │ grants │──▶│ funders │
                                     ┌─────────────┐    └────────┘   └─────────┘
              uses_dataset (M:N) ───▶│  projects   │───project_members──▶ researchers
                                     │ (status)    │
              uses_instrument (M:N)─▶└──┬───────┬──┘
                                        │       │
                        ┌───────────────▼──┐ ┌──▼─────────────┐ ┌────────────┐
                        │    datasets      │ │  instruments   │ │  software  │
                        │ dataset_versions │ │ instr_versions │ │            │
                        │ (access level)   │ │ (psychometric) │ └────────────┘
                        └──────────────────┘ └────────────────┘

  ── Cross-cutting ─────────────────────────────────────────────────────────────
  research_outputs (unifying supertype) · topics (M:N to most nodes) · files (object-store refs)
  licenses · collaborations · opportunities
  external_records + sync_jobs + sync_logs  (provenance & interoperability)
  ojs_sources · ojs_journals · ojs_articles · ojs_authors  (+ mapping tables)
  metrics · metric_snapshots · rvm_scores · rvm_dimensions · rvm_indicators
  notifications · audit_logs · verification_records
```

---

## 3. Table catalogue

Grouped by domain. All tables include `id uuid pk`, `created_at`, `updated_at`; soft-deletable tables add `deleted_at`. `⟨prov⟩` marks the provenance block (§9).

### 3.1 Identity & accounts
| Table | Key columns | Notes |
|---|---|---|
| `users` | email (unique, citext), password_hash (Argon2id), mfa_secret, status | Auth principal only. **Not** the scholarly identity. |
| `sessions` | user_id, token_hash, expires_at, rotated_from, ip, user_agent | Server-side sessions, rotation support. |
| `roles` / `user_roles` | role, scope_type, scope_id | RBAC; scoped to global/institution/department/group/journal (Spec §6, §49). |
| `researchers` | researchtrics_id (`RTX-…`, unique), given_names, family_name, preferred_name, bio, career_stage, researcher_type, verification_level, visibility settings (JSONB) | Core scholarly identity (Spec §7). |
| `researcher_identifiers` | researcher_id, scheme (enum: ORCID/OPENALEX/SCOPUS/WOS/SCHOLAR_URL), value, verified, ⟨prov⟩ | One row per external ID; unique (scheme, value). |
| `researcher_name_variants` | researcher_id, name, script, source | Disambiguation; previous names, transliterations (Spec §7). |
| `verification_records` | researcher_id, level, method, evidence_ref, verified_by, verified_at | Levels 0–5 (Spec §38). Auditable. |

### 3.2 Organizations
| Table | Key columns | Notes |
|---|---|---|
| `institutions` | name, ror_id, country, city, type, tenant flags | ROR as external ID; tenant boundary root (Spec §49). |
| `departments` | institution_id, name, parent_department_id | Self-referential hierarchy. |
| `affiliations` | researcher_id, institution_id, department_id, role, start_date, end_date, is_primary, verified, ⟨prov⟩ | Time-bounded M:N; never overwrite verified affil blindly (Spec §85). |
| `research_groups` | name, institution_id, lead_researcher_id, interests | Spec §27. |
| `research_group_members` | group_id, researcher_id, role, joined_at | M:N membership. |

### 3.3 Outputs & publications
| Table | Key columns | Notes |
|---|---|---|
| `research_outputs` | output_type (enum, Spec §9), public_id, slug, title, visibility, license_id, primary_file_id | Supertype for all output kinds; specialized detail tables reference it. |
| `publications` | output_id, abstract, journal_id, volume, issue, first_page, last_page, published_on, publisher, article_type, version_type | Version type: preprint/AM/VoR/correction/retraction (Spec §60). |
| `publication_identifiers` | publication_id, scheme (DOI/PMID/ISBN/ARXIV…), value, ⟨prov⟩ | Unique (scheme, value). |
| `publication_authors` | publication_id, researcher_id (nullable until matched), author_order, raw_name, affiliation_text, is_corresponding, match_confidence | Ordered authorship; unmatched authors kept as raw with confidence (Spec §58). |
| `citations` | citing_publication_id, cited_publication_id \| cited_external_doi, source (enum: CROSSREF/OPENALEX/…), ⟨prov⟩ | **Source-labelled**; counts never merged across providers (Spec §33). |
| `journals` | name, issn_print, issn_electronic, publisher, doaj_status, ojs_journal_id | ISSN unique where present. |
| `output_versions` | output_id, version_type, related_output_id, label | Links preprint↔VoR↔correction↔retraction (Spec §60). |
| `output_integrity_events` | output_id, kind (retraction/correction/EoC/dispute), notice, occurred_on | Never silently mutate records (Spec §59). |

### 3.4 Projects, datasets, instruments, software
| Table | Key columns | Notes |
|---|---|---|
| `projects` | title, description, status (proposed/active/completed/suspended/archived), pi_researcher_id, institution_id, start/end | Spec §19. |
| `project_members` | project_id, researcher_id, role | M:N team. |
| `project_links` | project_id, linked_type, linked_id | Associates outputs/datasets/instruments/software/grants. |
| `datasets` | output_id, creator, sample, geography, methodology, access_level (open/restricted/request/embargoed/private), ethics_info | Restricted never exposed (Spec §20). |
| `dataset_versions` | dataset_id, version, file_id, doi, released_on | Versioned. |
| `instruments` | output_id, construct, population, language, item_count, response_scale, scoring_method, reliability, validity_evidence, factor_structure, norms, copyright | Psychometric metadata (Spec §21). |
| `instrument_versions` | instrument_id, version, translation_of, adaptation_notes | Translations/adaptations. |
| `software` | output_id, name, version, repository_url, doi, documentation_url, citation_text | Spec §22. |
| `grants` | title, funder_id, amount (nullable/private), start/end | Spec §19. |
| `funders` | name, ror_id, country, funder_doi | Crossref funder registry mapping. |

### 3.5 Discovery, collaboration, topics
| Table | Key columns | Notes |
|---|---|---|
| `topics` | label, scheme (OpenAlex/internal), external_id | Controlled vocab; M:N to researchers/outputs/projects. |
| `*_topics` join tables | (entity_id, topic_id, score) | Weighted topic assignment. |
| `research_interests` | researcher_id, label | Free-text interests (Spec §7). |
| `collaborations` | researcher_a_id, researcher_b_id, basis, strength, first_coauthored_on | Derived + explicit (Spec §18). |
| `opportunities` | type (grant/fellowship/job/conference/CFP/…), title, deadline, source, ⟨prov⟩ | Spec §28. |
| `follows` / `saves` | actor_id, target_type, target_id | Scholarly feed actions, no vanity likes (Spec §32). |

### 3.6 Files & licensing
| Table | Key columns | Notes |
|---|---|---|
| `files` | storage_url, checksum (sha256), mime_type, size_bytes, access_level, license_id, uploader_id, malware_status, pdf_has_text | Object-store refs only; never blobs in PG (Spec §46). `pdf_has_text` feeds Scholar checker. |
| `licenses` | code (CC-BY, …, ARR, publisher-restricted, custom), name, url | Spec §34. |
| `rights_declarations` | file_id, declared_by, rights_status, embargo_until, confirmed_at | User confirms upload rights (Spec §34). |

### 3.7 Provenance & interoperability
| Table | Key columns | Notes |
|---|---|---|
| `external_records` | entity_type, entity_id, source, source_id, source_url, retrieved_at, last_synced_at, confidence, raw_payload (JSONB), normalized_payload (JSONB) | **The provenance spine** (Spec §84). One row per external observation of an entity. |
| `sync_jobs` | integration, kind, status, scheduled_at, started_at, finished_at, idempotency_key | Manual/scheduled/webhook sync (Spec §12). |
| `sync_logs` | sync_job_id, level, message, entity_ref | Per-item audit + errors + conflicts. |
| `ojs_sources` | base_url, site_id, version_detected, auth_meta | Inspect version first (Spec §12). |
| `ojs_journals` / `ojs_articles` / `ojs_authors` | ojs_*_id + FK to internal id | Mapping tables; idempotent, no duplicates. |

### 3.8 Metrics, RVM, notifications, audit
| Table | Key columns | Notes |
|---|---|---|
| `metrics` | entity_type, entity_id, metric_key, value, source, as_of | Raw counters (views, downloads, follows…) with bot-filtered flag (Spec §41). |
| `metric_snapshots` | entity_type, entity_id, period, captured_at, payload (JSONB) | Time-series for trends (30/90/365/all). Partition-ready. |
| `rvm_indicators` | key, dimension_id, formula_ref, normalization, weight, active_version | Configurable indicator registry (Spec §23). |
| `rvm_dimensions` | key, name, weight, active_version | 10 dimensions (Spec §23). |
| `rvm_scores` | subject_type, subject_id, version, overall, dimensions (JSONB), indicators (JSONB), confidence, missing_data (JSONB), calculated_at | Fully transparent, versioned computation (Spec §23, §25). |
| `notifications` | user_id, type, payload, channel, read_at | In-app + email (Spec §39). |
| `audit_logs` | actor_id, action, entity_type, entity_id, before (JSONB), after (JSONB), at, ip | Append-only; identity/claim/edit/verify/RVM/admin/sync (Spec §68). |

---

## 4. Key relationships & constraints

- **Researcher ↔ external IDs:** `researcher_identifiers` unique on `(scheme, value)`; prevents two researchers claiming the same ORCID. Matching writes `match_confidence`; auto-association only ≥ threshold (Spec §58).
- **Publication uniqueness:** dedup on DOI first, then `(normalized_title, year, first_author)` fuzzy via `pg_trgm` (Spec §57). Never auto-delete; flag for review.
- **Authorship:** `publication_authors` keeps every author as ordered raw text; researcher linkage is nullable and confidence-scored — unmatched authors still render on the public page.
- **Visibility:** every user-owned entity carries a visibility enum (public/researchers/institution/private) enforced in the RBAC gate, not the client (Spec §36).
- **Soft deletion:** scholarly records use `deleted_at` + integrity events; hard delete reserved for GDPR-style erasure via the export/delete workflow (Spec §36).

---

## 5. Indexing strategy (initial)

- B-tree unique: `researchers.researchtrics_id`, `research_outputs.slug`, `(scheme,value)` on identifier tables, `institutions.ror_id`, `journals.issn_*`.
- **GIN / `pg_trgm`** on `research_outputs.title`, `researchers` name columns for fuzzy match + dedup.
- **`tsvector`** generated columns + GIN for FTS on publications (title/abstract/keywords) and researcher profiles (MVP search, Spec §17, §47).
- Composite indexes on `metric_snapshots(entity_type, entity_id, period, captured_at)` and `citations(cited_publication_id, source)`.
- `external_records(entity_type, entity_id, source)` and `(source, source_id)` for idempotent upserts.

---

## 6. Search abstraction

MVP uses Postgres FTS + `pg_trgm` behind a `SearchIndex` interface (`packages/search`). Callers never issue engine-specific queries. A future OpenSearch adapter implements the same interface; a nightly job can reindex (Spec §47). Semantic/vector search is deferred — the interface leaves room for a hybrid ranker without refactoring callers.

---

## 7. Provenance & external-source priority (enforced in data)

Per Spec §85, when multiple sources describe one entity, `external_records` retains **all** observations; a normalization/merge service resolves the *display* record using source priority:

- **Publication metadata:** DOI/Crossref → publisher/OJS → ORCID → OpenAlex → researcher input.
- **Identity:** ORCID → institution verification → researcher confirmation → publication evidence.

No source overwrites a **verified** internal field automatically; conflicts create a `sync_log` review item (Spec §12, §85).

---

## 8. Migrations & seed

- Prisma migrations are the single migration history; every phase that changes schema ships a migration + is reversible in review (Spec §97).
- Seed data: license registry, RVM dimension/indicator defaults (clearly marked *provisional weights*), role catalogue, sample institution/journal for local dev and the Google Scholar test suite (Spec §70).

---

## 9. The provenance block ⟨prov⟩ (reused shape)

Every externally sourced row (or its linked `external_records` entry) carries:

```
source           text       -- 'CROSSREF' | 'ORCID' | 'OPENALEX' | 'OJS' | 'DATACITE' | 'USER'
source_id        text       -- DOI, ORCID iD, OpenAlex ID, OJS article id, …
source_url       text
retrieved_at     timestamptz
last_synced_at   timestamptz
confidence       numeric     -- 0..1
raw_payload      jsonb       -- original response, untouched
normalized_payload jsonb     -- mapped to internal shape
```

This is what makes the scholarly record auditable and non-destructive (Spec §84, §68).

---

*Schema is illustrative and pending review; Prisma models are authored in Phase 1 from this document. No tables exist yet.*
