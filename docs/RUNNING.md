# Running ResearchTrics locally

Two paths: the **Docker stack** (full: Postgres, Redis, MinIO, OJS) or a
**no-Docker** path using an embedded PostgreSQL for quick runs and CI.

## Prerequisites

- Node ≥ 20, pnpm 9 (`npm i -g pnpm@9`)
- `pnpm install` at the repo root

## Option A — Docker stack (recommended for full features)

```bash
cp .env.example .env                 # fill in values
docker compose -f docker/docker-compose.yml up -d   # postgres, redis, minio, ojs
pnpm --filter @researchtrics/db migrate               # apply migrations
pnpm --filter @researchtrics/db seed                  # reference data
pnpm dev                                              # web + worker
```

Web: http://localhost:3000 · OJS: http://localhost:8081 · MinIO console: http://localhost:9001

## Option B — No Docker (embedded PostgreSQL)

Uses `embedded-postgres` (a real Postgres binary, no admin needed). Great for a
quick look or CI; Redis-backed features (OJS sync enqueue) are inert without Redis.

**1. Start the database holder** (boots Postgres, applies the migration, seeds a
little demo content, and stays up):

```bash
pnpm --filter @researchtrics/web serve-db
# → "DB READY on postgresql://researchtrics:researchtrics@localhost:55433/researchtrics"
```

**2. In another shell, start the app against it:**

```bash
DATABASE_URL="postgresql://researchtrics:researchtrics@localhost:55433/researchtrics?schema=public" \
NEXT_PUBLIC_APP_URL="http://localhost:3000" \
TOKEN_ENCRYPTION_KEY="$(node -e "console.log(Buffer.alloc(32,7).toString('base64'))")" \
SESSION_SECRET="dev-session-secret-000000000000000000000" \
pnpm --filter @researchtrics/web build && pnpm --filter @researchtrics/web start
```

Open http://localhost:3000. Demo login: `ada@researchtrics.local` / `demo-password-123`.

## Full-stack integration smoke (real Postgres, no Docker)

Boots an ephemeral embedded Postgres, applies the migration, and exercises the
whole stack (identity + RTX/output IDs, DOI dedup, RVM, citation export, Google
Scholar checker, search):

```bash
pnpm --filter @researchtrics/web smoke
# → SMOKE RESULT: 19 passed, 0 failed
```

This runs in CI after build.

## Verified end-to-end (2026-08-12)

Against a real PostgreSQL 18: migration applies (36 tables); `/api/v1/health`
reports the DB up; `/discover`, `/researchers/{slug}`, and the authenticated
`/dashboard/rvm` (RVM computed + persisted) render with seeded data; 19/19
integration smoke checks pass; no console or server errors.
