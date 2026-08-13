# Data Source Compliance (Discovery Engine §38, §61)

> **Rule:** no discovery source is integrated until its permitted use has been reviewed and recorded here. This document is the register of what ResearchTrics may ingest, from where, and under what terms.

## Hard prohibitions (never, under any configuration)

ResearchTrics does **not** scrape, crawl, or harvest from platforms where automated collection is restricted or against terms:

- ResearchGate
- Academia.edu
- Google Scholar
- LinkedIn
- Scopus
- Web of Science
- any private database or login-gated source

It never harvests private email addresses, phone numbers, home addresses, or other sensitive personal information. Only permitted **public scholarly metadata** is ingested.

## Approved sources

| Source | Access method | Identity authority | Terms / license | Attribution | Rate policy | Status |
|---|---|---|---|---|---|---|
| **Fixture (local)** | In-repo dataset | None (test only) | N/A | N/A | N/A | ✅ Active (D1) — offline prototype per §67 |
| **OpenAlex** | Public REST API | Evidence only (not authoritative) | CC0 data | "Data from OpenAlex" | Polite pool + rate limit + cache; incremental sync | ⏳ Wired in D2 (config-gated) |
| **Crossref** | Public REST API (polite pool) | Evidence (publication metadata) | Metadata openly available; no copyrighted full text | Cite DOI/Crossref | Polite pool w/ contact UA; cache; rate limit | ⏳ Wired in D2 |
| **ORCID** | Public API + OAuth | **Authoritative only after OAuth** ownership proof | ORCID public data + user-authorized | Per ORCID policy | Permitted sync model | ⏳ OAuth exists; discovery use in D2 |
| **OJS** | OAI-PMH / REST (per install) | Publisher author data | Per-install permission | Per-install | Webhook/scheduled sync | ✅ Ingestion exists (Phase 4) |
| **Institutional repositories / DSpace / EPrints** | OAI-PMH where permitted | Evidence | Per-institution permission | Per-institution | Configured schedule | ⏳ Future (D2+) |
| **PubMed / DataCite / ROR** | Public API | Evidence | Open | Per-provider | Rate limit + cache | ⏳ Future |

## Provenance requirement (§5, §36)

Every ingested datum records: `source`, `source_id`, `source_url`, `retrieved_at`, `last_synced_at`, `confidence`. Provenance is stored on `researcher_sources` and is never hidden — administrators can view every field's origin.

## Identity authority order (§37)

For **identity**: ORCID verified by OAuth › institutional verification › publisher/OJS author data › Crossref › OpenAlex › name similarity.
For **publication metadata**: DOI/Crossref › publisher/OJS › OpenAlex › researcher input.
Researcher corrections are always preserved and audited.

## Per-connector obligations (§60)

Every external connector must implement: rate limiting, backoff, retry, cache, timeout, and a circuit breaker. Large discovery runs execute only in background jobs (§23, §52) — never inside a web request.

## Identity vs. visibility (§26, §54)

**Identity Confidence** (how sure we are *who* this is) is a distinct construct from the **RVM** (research visibility). They are never combined. A discovered, unclaimed profile is never treated as a verified RVM profile.

## Review log

| Date | Source | Reviewed by | Decision |
|---|---|---|---|
| 2026-08-13 | Fixture (local) | Engineering | Approved for offline prototype (D1) |
| _pending_ | OpenAlex, Crossref | — | To be confirmed before D2 live enablement |
