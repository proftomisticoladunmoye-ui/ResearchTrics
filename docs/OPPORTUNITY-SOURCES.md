# Opportunity Ingestion — Sources & Compliance Register

The opportunity engine ingests forward-looking listings (grants, fellowships,
calls, positions) from legitimate sources with open APIs. It mirrors the
discovery/federation engines: a provider abstraction with an injectable
`fetchImpl` (offline-testable), a fixture provider, and each real source
**config-gated until its terms are reviewed and signed off**.

## Integrity rules
- **Provenance on everything** — each ingested listing stores `source =
  import:<provider>` and `sourceUrl`. Nothing is scraped or fabricated.
- **Providers never overwrite others** — ingestion dedupes on `(source,
  sourceUrl)` and only ever updates its own imported records. Manual listings and
  other sources are untouched.
- **Idempotent** — re-running updates in place; no duplicates.
- **Lifecycle** — ingested rows publish as `open` and are auto-closed by the
  hourly expiry sweep once past their `deadline` (never deleted).

## How ingestion is enabled (gated)
A real source runs **only** when it is listed in the worker env var, after its
terms have been reviewed:

```
OPPORTUNITY_INGEST_SOURCES=grants_gov
```

Each listed source is scheduled as a daily repeatable worker job. With the var
unset (the default), no live ingestion runs.

## Source register

| Source | Provider | Status | Terms |
|---|---|---|---|
| **Fixture** | `fixture` | ✅ built (offline sample data) | n/a |
| **Grants.gov** (US federal funding) | `grants_gov` | ✅ built, **gated** | US-government open data; review Grants.gov API terms before enabling |
| **EU Funding & Tenders** (SEDIA) | `eu_funding` | ✅ built, **gated** — *verify fields on first live enable* | Review EU F&T API terms before enabling |
| UKRI Gateway to Research | — | ❌ not a fit | GtR API returns **awarded projects**, not open calls |
| NIH (Guide/RePORTER) | — | ⬜ deferred | Guide RSS blocks bots; RePORTER is awarded projects |
| Conference / CFP feeds | — | ⬜ planned | Terms need careful review |

> **EU Funding & Tenders caveat:** built against the *documented* SEDIA response
> shape (metadata-as-arrays, coded statuses: forthcoming/open/closed). Because the
> live API is POST-only and couldn't be sampled during build, the field mapping
> should be verified against a real response the first time it is enabled — the
> mapper skips malformed records rather than corrupting data, and it is off by
> default. Base URL override: `EU_FUNDING_BASE_URL`.

## Grants.gov specifics
- Uses the public **Search2 API** (`POST /v1/api/search2`, `oppStatuses: posted`).
- Maps each hit → title, agency (organization), open/close dates (MM/DD/YYYY),
  a canonical detail URL, `country: US`, `type: grant`.
- Base URL override: `GRANTS_GOV_BASE_URL`.

## Build order (one source at a time)
Grants.gov is done. Next candidates in order of lowest terms-risk / highest
volume: **UKRI Gateway to Research**, then **EU/OpenAIRE**, then **NIH**, with
conference/CFP feeds last (their terms are the most restrictive).
