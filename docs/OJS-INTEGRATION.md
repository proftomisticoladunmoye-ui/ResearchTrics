# OJS Integration

> **Status:** Implemented in Phase 4 (runtime probe + OAI-PMH harvest + idempotent sync + admin dashboard). **Package:** `@researchtrics/integration-ojs`.
>
> **Live end-to-end validation** (against the fresh OJS 3.4 in `docker-compose`) is pending the Docker stack running — Docker is not installed in the current build environment. Parsing, mapping, and idempotency logic are unit-tested; the harvest is standards-based (OAI-PMH).

## Principle (Spec §12)

OJS is the **editorial/publishing layer**. **ResearchTrics remains the master identity and research-intelligence layer** — OJS never becomes the platform, and it may **not overwrite verified ResearchTrics researcher identity**.

## Inspect first — never assume a version (Spec §12, §93)

On connect, a **capability probe** inspects the live installation:

1. Tries site-wide **OAI-PMH** endpoints (`/index.php/index/oai`, `/index/oai`, `/oai`) via the `Identify` verb.
2. Best-effort **version detection** from the `Identify` response (`Open Journal Systems x.y.z`).
3. Best-effort **native REST** availability check (`/api/v1/contexts` → 200/401/403 = present).

Results (OAI URL, detected version, strategy, REST availability) are stored on `ojs_sources` — **nothing is hard-coded**.

## Harvest strategy

- **OAI-PMH (default, implemented):** standardized, present on essentially all OJS installs, and independently verifiable. `ListRecords` (`oai_dc`) is streamed with resumption-token paging; Dublin Core is mapped to the shared `NormalizedPublication` shape.
- **Native REST (scaffold):** OJS REST endpoints/auth vary by major version; the strategy is stubbed behind the probe and **must be implemented and verified against the detected install** before enabling (Spec §93).

## Idempotent sync (Spec §12, §57)

```
syncOjsSource(sourceId)
  → ensureProbed (persist detected capabilities)
  → harvestOai(oaiUrl)  [resumption-token paging]
  → for each record:
      key = (ojs_source_id, ojs_article_id)      // ojs_articles mapping
      hash = sha256(normalized core fields)
      if mapped & hash unchanged → skip (no-op)
      else if DOI known & publication exists → link
      else → createPublicationFromNormalized (core: ORCID-only author linking,
             source-labelled counts, provenance source='ojs', audit)
      upsert ojs_articles mapping (internal id + hash)
  → SyncJob counters + status (completed/partial/failed); SyncLog per error
```

- **No duplicates:** keyed on OJS article id and DOI. Re-runs are safe.
- **Provenance:** every synced record writes an `external_records` row (`source=ojs`).
- **Mapping tables:** `ojs_sources`, `ojs_journals`, `ojs_articles`, `ojs_authors`.
- **Author identity:** auto-links only via verified ORCID (Spec §58); verified internal identity is never overwritten.

## Modes (Spec §12)

- **Manual:** admin "Sync now" → enqueues an `ojs.sync` job (heavy work runs in the **worker**, never inline — Spec §43).
- **Scheduled / webhook:** the same job is designed for cron/event triggers (wired in a later ops pass).
- **Retry + DLQ + status + logs:** via BullMQ job options and `sync_jobs` / `sync_logs`.

## Admin dashboard (Spec §37)

`/admin/ojs` (admin-gated): add a source (probes on add), see detected version/OAI/REST + last sync, trigger sync, and review recent `sync_jobs`.

## Configuration (`.env`)

```
OJS_BASE_URL=http://localhost:8081     # the docker-compose OJS
OJS_SITE_ID=
OJS_API_KEY=                            # if the detected install supports it (encrypted at rest)
```

## To validate end-to-end (when Docker is available)

```bash
docker compose -f docker/docker-compose.yml up -d        # starts OJS 3.4 + MariaDB + infra
# grant your user an admin role (see docs/ADMIN.md), then:
# /admin/ojs → Add source (http://localhost:8081) → Sync now
```

## Not yet implemented
- Native REST harvest (verify against detected version first).
- Journal/issue-level mapping population beyond article-level (OAI sets → `ojs_journals`).
- Webhook/event sync triggers.
