# Scholarly Data Sources — Compliance Register (addendum §36)

> Companion to `SCHOLARLY-METADATA-FEDERATION.md`. **No source is integrated until its current official documentation and applicable terms have been reviewed and its row here marked reviewed** (§36, §46). Extends `DATA-SOURCE-COMPLIANCE.md`.

## Hard prohibitions (never, any configuration — §44)

No scraping/harvesting from ResearchGate, Academia.edu, Google Scholar, LinkedIn, Scopus, Web of Science, or any access-controlled/private source. No private-email harvesting. No sensitive-attribute inference. Only permitted **public scholarly metadata / licensed data / authorized institutional sources**.

## Provider register

| Provider | Access | Primary use | Identity authority | License / terms (to confirm) | Attribution | Rate policy | Status |
|---|---|---|---|---|---|---|---|
| **Crossref** | REST (polite pool) | DOI publication metadata (§3) | Evidence | Metadata openly available; **no copyrighted full text** | Cite DOI/Crossref | Polite pool + contact UA, cache, rate limit | ✅ Integrated (adapter + discovery) |
| **OpenAlex** | REST | Authors/works/institutions/topics/citations graph (§9) | Evidence (not authoritative) | CC0 data | "Data from OpenAlex" | `mailto` polite pool, cache, incremental | ✅ Integrated |
| **ORCID** | Public API + OAuth | Researcher identity + verification (§10) | **Authoritative only after OAuth** | ORCID public data + user-authorized | Per ORCID policy | Permitted sync model | ✅ Integrated (OAuth + claiming) |
| **OJS** | OAI-PMH / REST | Journal/article publishing metadata (§11) | Publisher author data | Per-install permission | Per-install | Webhook/scheduled | ✅ Integrated (Phase 4) |
| **DataCite** | REST | Datasets/software/research objects as DOI objects (§4–§5) | Evidence (DOI research objects) | DataCite metadata terms — **final terms sign-off required before live enablement** | Cite DataCite/DOI | Rate limit + cache | 🟡 F2 adapter implemented (offline/fixture-tested); **live ingestion gated on terms sign-off** |
| **PubMed / NCBI E-utilities** | E-utilities API (esearch/esummary) | Biomedical/health metadata + pubtypes (§6–§7, §27) | Evidence (domain-specific) | NCBI usage policy — **API key + tool/email required before live enablement** | Per NCBI policy | E-utilities rate limits (key required for higher) | 🟡 F3 adapter implemented (offline/fixture-tested); **live ingestion gated on NCBI key + policy sign-off** |
| **ROR** | REST / data dump | Institution normalization (§8) | Institutional identity | CC0 (open) | "Data from ROR" | Cache; dump-friendly | ✅ F4 adapter implemented (offline/fixture-tested); CC0 — live enablement is low-risk |

## Future providers — architected, **not** implemented (§12–§15)

OpenCitations, DOAJ, OpenAIRE, Semantic Scholar, DSpace, EPrints, Scopus, Web of Science. Each requires its own compliance-register row + review before any implementation. **DOAJ inclusion is never used as a journal-quality score** (§13). Scopus/WoS are licensed/restricted — API/licensed access only, never scraping (§44).

## Per-provider obligations (§35, §36)

Every connector must record and honor: provider · API endpoint · license · allowed usage · attribution requirements · rate limits · commercial-use restrictions · data-retention rules; and implement rate limiting, backoff, retry, cache, timeout, and a circuit breaker. Large imports run in background workers only (§35).

## Provenance & identity-vs-visibility

Every ingested datum records `source`, `sourceId`, `sourceUrl`, `retrievedAt`, `lastSyncedAt`, `confidence` in `external_records` (§17, §38). **Identity confidence and RVM remain distinct** and are never combined (§39).

## Review log

| Date | Source | Reviewed by | Decision |
|---|---|---|---|
| 2026-08-13 | Crossref, OpenAlex, ORCID, OJS | Engineering | Approved (already integrated per prior phases) |
| _pending_ | DataCite | — | Review official docs + terms before F2 |
| _pending_ | PubMed/NCBI | — | Review NCBI usage policy; obtain API key + tool/email before F3 |
| _pending_ | ROR | — | Review terms before F4 |
