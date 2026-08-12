# ORCID Integration

> **Status:** Implemented in Phase 2 (connect + verify + minimal public-profile import). Works import lands in Phase 3 with the publication engine.
> **Package:** `@researchtrics/integration-orcid`

ResearchTrics uses ORCID to **verify researcher identity** and import a minimal public profile with consent. ORCID is authoritative for *identity verification* (raises the researcher to **Verification Level 3**); it never silently overwrites researcher-provided data (Spec §13, §85).

## Endpoints & environments

Endpoints are **env-selected** and pinned per environment. They follow ORCID's public 3-legged OAuth and **must be re-verified against the official ORCID documentation before production** (Spec §93). No host is hard-coded into business logic.

| | Sandbox (default) | Production |
|---|---|---|
| OAuth host | `https://sandbox.orcid.org` | `https://orcid.org` |
| Authorize | `…/oauth/authorize` | `…/oauth/authorize` |
| Token | `…/oauth/token` | `…/oauth/token` |
| Public API | `https://pub.sandbox.orcid.org/v3.0` | `https://pub.orcid.org/v3.0` |

Selected by `ORCID_ENVIRONMENT` (`sandbox` | `production`). All pre-production testing uses **sandbox**.

## Configuration (`.env`)

```
ORCID_ENVIRONMENT=sandbox
ORCID_CLIENT_ID=...
ORCID_CLIENT_SECRET=...
ORCID_REDIRECT_URI=http://localhost:3000/api/v1/integrations/orcid/callback
```

If these are unset, the "Connect ORCID" action degrades gracefully (redirects with `?orcid=unconfigured`) rather than erroring.

## Flow

```
Dashboard → "Connect ORCID"
  GET /api/v1/integrations/orcid/connect
    → set CSRF state cookie (HttpOnly, 10-min)
    → redirect to ORCID authorize (scope=/authenticate)
  ← ORCID redirects back with ?code&state
  GET /api/v1/integrations/orcid/callback
    → verify state == cookie (CSRF)
    → exchangeCode(code) → { access_token, orcid, name, ... }
    → guard: iD not already linked to another researcher (Spec §58)
    → ENCRYPT tokens (AES-256-GCM) → store OrcidConnection
    → upsert ResearcherIdentifier(scheme=orcid, verified=true)
    → setVerificationLevel(3, method='orcid')  [audited]
    → import public record (fills empty fields only; adds new interests)
       → writes ExternalRecord provenance (source=orcid)
    → redirect to /dashboard/profile?orcid=connected
```

## Security (Spec §13, §35)

- **CSRF**: opaque `state` in an HttpOnly cookie, compared on callback.
- **Tokens encrypted at rest** via `AES-256-GCM` (`TOKEN_ENCRYPTION_KEY`); **never** returned to callers or the frontend.
- **Ownership**: an ORCID iD maps to at most one researcher (unique constraint + explicit guard).
- **Revocation**: `disconnectOrcid` removes the stored connection and marks the identifier unverified while preserving identity history.

## Import policy (Spec §85)

Only **empty** profile fields (biography, given/family name) are filled from ORCID; existing researcher-provided values are never overwritten. Keywords become research interests, skipping duplicates. Every import writes an `external_records` provenance row (`source=orcid`, `retrieved_at`, `normalized_payload`).

## Testing

- `buildAuthUrl` and `normalizeRecord` are pure and unit-tested (no network).
- Network calls accept an injectable `fetch` for deterministic integration tests.

## Not yet implemented (later phases)

- Works/publications import (Phase 3, publication engine).
- Member API (read-limited / write) — Public API + user-authorized read only for now.
- Token refresh scheduling.
