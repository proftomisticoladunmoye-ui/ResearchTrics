# Phase 7 — Search & Discovery (Implementation Notes)

> **Status:** Implemented and validated. Awaiting review.
> **Note:** Delivered ahead of Phase 6 by request to complete an MVP-critical surface. Projects/datasets/instruments/software (Phase 6) fold into the same interface when they exist.

## Delivered

### `packages/search` — engine-agnostic search (Spec §17, §47)
- **`SearchIndex` interface** + typed `SearchQuery` / `SearchResult` / `SearchHit` / `SearchFacets`. Callers depend on the interface, not the engine — a future **OpenSearch** or **vector/hybrid** implementation drops in without changes.
- **`PostgresSearchIndex`** — MVP implementation over Prisma: case-insensitive matching across researchers (name, bio, interests), publications (title, abstract), institutions (name, city), journals (name, publisher); filters (type, country, year range, open access, verified); per-type **facet counts**; JS **relevance scoring** (exact > prefix > word > substring); merge + rank + paginate. `pg_trgm` (enabled in `init.sql`) is available for future fuzzy ranking.
- **`InMemorySearchIndex`** — reference implementation for deterministic tests and small demos.
- Pure helpers: `parseSearchParams`, `relevanceScore`, `normalizePaging` — all unit-tested.

### Web
- **`/discover`** — global search: query box, **type facet tabs** with counts, filter sidebar (year range, country, open access, verified), ranked mixed results with type badges, pagination.
- **`GET /api/v1/search`** — JSON search API.
- Header "Discover" and landing "Discover Research" CTAs now resolve.

## Validation results
- **Tests:** 61 passing (+7 search: param parsing, relevance tiers, paging clamp, in-memory ranking/facets/filters).
- **Type-check / Lint:** clean across all **12 packages**.
- **Build:** `/discover` + `/api/v1/search` compile.

## Design notes
- **Fast + Postgres-first** (Spec §17): no premature Elasticsearch (Spec §47) — hidden behind the interface instead.
- **Only public content** is searchable (deleted/private excluded at the query level).
- Facet counts span all types (so tabs show numbers) while results respect the selected type.

## Deferred within the phase (documented)
- Stored `tsvector` + GIN indexes for ranked FTS at scale (current impl computes matches per query; the interface makes this a drop-in upgrade with a migration).
- Semantic/vector + hybrid search (Spec §47) — same interface, later.
- Extending search to projects/datasets/instruments/software/topics once Phase 6 lands.
- Discipline/methodology/language facets (need the topic + methodology model from later phases).

## Exit gate
Sub-second global search across the four live entity types with filters, facets, ranking, and pagination, behind a swappable interface; pure logic unit-tested. **STOP FOR REVIEW.**
