# Crossref Integration

> **Status:** Implemented in Phase 3. **Package:** `@researchtrics/integration-crossref`.

Crossref is the **authoritative source for publication metadata** (Spec §85) — DOI → title, authors (with ORCIDs + affiliations), journal, ISSN, volume/issue/pages, dates, publisher, license, reference count, and PDF links.

## Access & etiquette

- Crossref REST API, **no key required**.
- **Polite pool**: an identifiable `User-Agent` including a contact `mailto` (`CROSSREF_MAILTO`) is sent on every request (Spec §14).
- Base URL is env-configurable (`CROSSREF_BASE_URL`, default `https://api.crossref.org`) and must be re-verified against Crossref docs before production (Spec §93).
- 404 → `NotFoundError` (surfaced as "no metadata found for that DOI"); other non-2xx → error with status.

## Import pipeline (Spec §56)

```
User enters DOI
  → validate DOI syntax (never fabricate — Spec §61)
  → dedup: existing publication with this DOI? → return existing
  → Crossref lookup (authoritative)
  → OpenAlex enrichment (best-effort: citations, abstract fallback)
  → merge → normalized CreatePublicationInput
  → mint RTP id + slug, upsert journal
  → author matching (verified ORCID only auto-links — Spec §58)
  → store publication + identifiers + authors + citation counts + provenance
  → audit
```

## Mapping notes

- Abstracts are JATS/HTML — markup is stripped to plain text.
- `is-referenced-by-count` → a **Crossref-labelled** citation count (never merged with other sources — Spec §33).
- Author ORCIDs are normalized to bare iDs; affiliations captured as text.
- License URLs are mapped to CC codes where recognizable.
- The pure `mapCrossref` function is unit-tested without network; `fetchByDoi` accepts an injectable `fetch`.

## Config (`.env`)

```
CROSSREF_MAILTO=you@example.org
# CROSSREF_BASE_URL=https://api.crossref.org   # optional override
```

## Not yet implemented
- Response caching layer (the provenance table already records `retrieved_at`/`last_synced_at`; a Redis/TTL cache lands with the worker sync jobs).
- Reference-list ingestion and funder registry mapping.
