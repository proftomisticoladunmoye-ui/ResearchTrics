# Phase F3 — PubMed Adapter & Biomedical Footprint (Implementation Notes)

> **Status:** Implemented and validated (incl. real-DB smoke with a stubbed provider). Awaiting review.
> PubMed adapter implemented and offline/fixture-tested; **live ingestion is gated on an NCBI API key + usage-policy sign-off** (see `SCHOLARLY-DATA-SOURCES.md`). No schema change.

## Delivered

### `packages/federation`
- **`PubMedMetadataProvider`** (§6, §7) — NCBI E-utilities (`esearch` → `esummary`): `searchWorks({name})`, `getWork({pmid})`, `healthCheck`. Pure `mapPubMedSummary` extracts PMID/DOI/PMCID, journal, year, authors, and publication types, with provenance. NCBI `tool`/`email`/`api_key` supported. Injectable HTTP → **offline unit-tested** (URL-aware stub for the two-step call).
- `NormalizedWork` gained optional `keywords` (MeSH/subjects) + `publicationTypes`; `pubmed` registered in the factory.

### Core — `getBiomedicalFootprint`
- **`getBiomedicalFootprint(researcherId)`** (§27) — searches PubMed by the researcher's name and returns their biomedical publications as **candidates**, with a **count + presence indicator** — explicitly **a footprint, not a quality score** (§27). Provider injectable.

### Web
- **Biomedical footprint** card on `/dashboard/discover-outputs` — PubMed record count, PMID/PMCID, publication types, labelled "**not a quality score**".

## Validation results
- **Tests:** 17 federation unit tests (+5: `mapPubMedSummary` incl. no-DOI case, `searchWorks` esearch→esummary, no-name guard, `getWork`).
- **Type-check / Lint:** clean across all packages (sequential).
- **Real-DB smoke:** 85/85 — +2: biomedical footprint counts PubMed records with a presence indicator, and PubMed records carry **PMID + provenance** (validated offline with a stubbed provider).
- **Build:** web app builds with the footprint card.

## Integrity notes (§6, §27, §38)
- PubMed is evidence, domain-specific — **not authoritative for all disciplines**, and not every record has a DOI (both handled).
- The biomedical footprint is a **count/indicator, never a ranking or quality score** (§27).
- Every record carries PubMed provenance; **no live NCBI calls** were made — validation is offline/fixture.

## Deferred (documented)
- MeSH-term extraction (needs `efetch` XML) — the model carries `keywords`; esummary JSON doesn't include MeSH. F6 or a later enrichment pass.
- Related-articles (elink) and using PubMed as identity-resolution evidence (§7) — the adapter provides the records; wiring coauthor/affiliation evidence into the identity engine is a later step.
- Live PubMed ingestion → after NCBI key + policy sign-off; a `federation.sync` worker job → F6.

## Exit gate
A PubMed adapter (esearch/esummary/getWork/health) behind the federation interface, and a biomedical-footprint service that counts candidates without judging quality; offline/fixture-validated. **STOP FOR REVIEW.**
