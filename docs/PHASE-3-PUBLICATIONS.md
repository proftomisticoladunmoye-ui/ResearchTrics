# Phase 3 — Publication Engine (Implementation Notes)

> **Status:** Implemented and validated. Awaiting review before Phase 4.

Delivers publications as first-class graph nodes: DOI import (Crossref authoritative + OpenAlex enrichment), dedup, ORCID-based author matching, public crawlable publication pages with citation metadata, and citation exports.

## Delivered

### Data model (`packages/db`)
`Journal`, `Publication`, `PublicationIdentifier`, `PublicationAuthor` (nullable researcher link + confidence), `PublicationCitationCount` (source-labelled), `File` (object-storage ref). Enums: `OutputType` (23 types, Spec §9), `PublicationVersion`, `PublicationIdScheme`, `CitationSource`, `FileAccessLevel`. RTP id sequence added.

### Integrations
- `@researchtrics/integration-shared`: polite HTTP (identifiable UA + mailto), `NormalizedPublication` contract, DOI normalize, JATS strip.
- `@researchtrics/integration-crossref`: DOI → authoritative metadata. See [`CROSSREF-INTEGRATION.md`](./CROSSREF-INTEGRATION.md).
- `@researchtrics/integration-openalex`: enrichment (citations, abstract via inverted index). See [`OPENALEX-INTEGRATION.md`](./OPENALEX-INTEGRATION.md).

### Core (`packages/core`)
- **DOI**: validate / normalize / assert (Spec §61) — pure, tested.
- **Publication persistence**: `createPublicationFromNormalized` (idempotent on DOI, mints RTP id + slug, upserts journal, ORCID-only auto author-linking, source-labelled citation counts, provenance, audit), `getPublicationBySlug`, `listPublications`, `claimAuthorship`, `buildCitationData`. Orchestration kept **out** of core to avoid a dependency cycle.
- **Citation exports** (Spec §10): BibTeX, RIS, EndNote, APA, Vancouver, Chicago — pure + tested.
- **File storage** (Spec §46): provider abstraction (local-fs dev provider), MIME allowlist, sha256, **image-only-PDF rejection** heuristic (`pdfLikelyHasText`, Spec §11), `storeFile`.

### Web (`apps/web`)
- Import orchestrator (`lib/import-publication.ts`): DOI → Crossref (fatal on miss) → OpenAlex (best-effort) → merge → core.
- **Public, crawlable** `/publications` and `/publications/[slug]` — the latter emits **Highwire `citation_*` meta**, `ScholarlyArticle` JSON-LD, canonical + OG, author links to profiles, **source-labelled citation counts**, PDF/publisher links, and **citation export buttons**.
- API: `POST /api/v1/publications/import`, `GET /api/v1/publications/[slug]/cite?format=…`.
- Dashboard `/dashboard/publications`: import-by-DOI form + "linked to you" list (auto-linked vs claimed).

## Validation results
- **Tests:** 45 passing (core 32 incl. DOI, exports, storage; crossref 4; openalex 3; orcid 3; config 3).
- **Type-check / Lint:** clean across all **10 packages**.
- **Build:** all routes compile (verified below).

## Design & integrity notes
- **Crossref authoritative**, OpenAlex enriches; citation counts **never merged** across providers (Spec §33).
- **Dedup on DOI**; no silent auto-merge (Spec §57).
- **Author auto-linking only via verified ORCID** (Spec §58); every author renders even when unmatched; users can claim.
- Every import writes `external_records` provenance for both sources (Spec §84) and an audit log (Spec §68).
- `citation_*` meta + JSON-LD land here; the **Google Scholar Compliance Checker + sitemaps** are Phase 5.

## Deferred within the phase (documented)
- **Hosted PDF upload UI + file-serving route**: storage abstraction, validation, and `File` model are in place; publications currently carry an external `citation_pdf_url` (from Crossref/OpenAlex). Upload endpoint + `/api/v1/files/*` serving lands alongside the Phase 5 PDF-compliance work.
- **Response caching** for Crossref/OpenAlex → worker sync jobs (Phase 9).
- **Manual DOI-less entry** + title/author fuzzy dedup warnings → small follow-up.

## Exit gate
Import a DOI end-to-end (Crossref + OpenAlex) with dedup, ORCID author-linking, and provenance; public publication page renders with citation metadata + JSON-LD; six citation exports download. **STOP FOR REVIEW** before Phase 4 (OJS Integration).
