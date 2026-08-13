# Phase F4 — ROR Adapter & Institution Normalization (Implementation Notes)

> **Status:** Implemented and validated (incl. real-DB smoke with a stubbed provider). Awaiting review.
> ROR is CC0 (open) — the adapter is offline/fixture-tested and live enablement is low-risk. Small additive schema change (Institution `aliases`, `website`).

## Delivered

### Data model (`packages/db`) — migration → **48 tables**
- `Institution.aliases String[]` + `Institution.website String?` (Federation §8: store alternate names/acronyms + homepage that resolve to the canonical institution).

### `packages/federation`
- **`RORMetadataProvider`** (§8) — Research Organization Registry: `searchInstitutions({name, country})`, `getInstitution({ror})`, `healthCheck`. Pure `mapRor` (aliases, acronyms, country, website, types) + `bareRorId` (strips `https://ror.org/…`). Injectable HTTP → **offline unit-tested**.
- `NormalizedInstitution` + `InstitutionSearchQuery` types; `getInstitution?`/`searchInstitutions?` on the interface; `ror` in the factory.

### Core — `institution-normalization.ts`
- **`resolveInstitution(name)`** — ROR candidate matches (surfaces, never auto-merges, §8).
- **`linkInstitutionToRor(institutionId, {rorId|record})`** — sets ROR id, canonical name, **aliases**, website, country, type; audited. Refuses to link a ROR id already owned by another institution (that's a merge candidate, not a silent overwrite).
- **`findInstitutionByRor(rorId)`** — dedup lookup.

### Web
- **ROR section** on `/institutions/[slug]/admin` — shows the current ROR link and a "Find ROR match" → candidate list → **Link** action; tenant-guarded APIs `resolve-ror` / `link-ror`.

## Validation results
- **Tests:** 22 federation unit tests (+5: `bareRorId`, `mapRor`, `searchInstitutions` incl. country filter, `getInstitution`).
- **Type-check / Lint:** clean across all packages (sequential).
- **Real-DB smoke:** 88/88 — +3: ROR resolves a name to a candidate with a ROR id, linking sets **ROR id + aliases + website** on the institution, and the institution is then **findable by its ROR id** (validated offline with a stubbed provider).
- **Build:** web app builds with the ROR admin section.

## Integrity notes (§8)
- Institution identity is normalized to a stable ROR id; name variants resolve to one canonical institution.
- Resolution only **surfaces candidates** — linking is deliberate and audited, never auto-merged.
- A ROR id already linked elsewhere routes to a merge decision, not a silent overwrite.
- **No live ROR calls** were made — validation is offline/fixture; ROR is CC0 so live enablement is low-risk.

## Deferred (documented)
- Auto-resolving discovered institutions to ROR during discovery ingestion (enrichment) — service exists; wiring into the discovery pipeline is later.
- Institution merge in the review queue when two institutions map to one ROR id (§57 for institutions).

## Exit gate
A ROR adapter (search/get/health) behind the federation interface, institution normalization that links a canonical ROR identity with aliases/website, and a tenant-guarded admin surface; offline/fixture-validated. **STOP FOR REVIEW.**
