# OpenAlex Integration

> **Status:** Implemented in Phase 3 (DOI enrichment). **Package:** `@researchtrics/integration-openalex`.

OpenAlex is used for **discovery and enrichment** — citation counts, abstracts (via inverted index), and bibliographic fallback. It is **never authoritative for identity** (Spec §15); OpenAlex Author/Work IDs are stored as mappings only.

## Access & etiquette

- OpenAlex REST API, free. Optional `OPENALEX_MAILTO` joins the polite pool; optional `OPENALEX_API_KEY` if a tier requires it.
- Base URL env-configurable (`OPENALEX_BASE_URL`, default `https://api.openalex.org`), re-verified against docs before production (Spec §93).
- Work lookup by DOI: `/works/doi:{doi}`.

## What we take

- `cited_by_count` → an **OpenAlex-labelled** citation count (kept separate from Crossref's — Spec §33).
- `abstract_inverted_index` → reconstructed plain-text abstract (used only when Crossref lacks one).
- Bibliographic fallback (journal, volume/issue/pages), OpenAlex work id, and OA PDF URL.
- Authorships → normalized authors (ORCID stripped to bare iD). **Not** used to assert identity.

## Authority stance (Spec §15, §85)

- Crossref wins for publication metadata; OpenAlex fills gaps only.
- Internal `RTX` identity remains authoritative; OpenAlex author ids are mappings.

## Config (`.env`)

```
OPENALEX_MAILTO=you@example.org
# OPENALEX_API_KEY=            # only if your tier requires it
# OPENALEX_BASE_URL=https://api.openalex.org
```

## Testing

`mapOpenAlex` and `reconstructAbstract` are pure and unit-tested; `fetchByDoi` accepts an injectable `fetch`.

## Not yet implemented
- Related-works / related-researchers discovery (Phase 7–8).
- Scheduled citation refresh (worker job, Phase 9).
