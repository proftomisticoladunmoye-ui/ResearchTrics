# Database — Neon (serverless Postgres)

ResearchTrics runs on **Neon**. The Prisma datasource uses a pooled connection for
the app and a direct connection for migrations (already wired in `schema.prisma`
via `url = env("DATABASE_URL")` + `directUrl = env("DIRECT_URL")`).

## Connection strings
Neon gives two hosts for the same database:

| Env var | Host | Used by | Query params |
|---|---|---|---|
| `DATABASE_URL` | `...-pooler...` (PgBouncer) | app / Prisma Client runtime | `?sslmode=require&pgbouncer=true` |
| `DIRECT_URL` | same host **without** `-pooler` | `prisma migrate` | `?sslmode=require` |

Put both in a **gitignored** env file — locally `packages/db/.env`; in hosting
(e.g. Vercel) as project environment variables. Never commit real credentials.

## First-time / redeploy setup
```bash
# 1. Apply schema (uses DIRECT_URL — the pg_trgm extension + all tables + sequences)
pnpm --filter @researchtrics/db exec prisma migrate deploy

# 2. Seed reference data (idempotent — safe to re-run)
pnpm --filter @researchtrics/db exec prisma db seed
```

`prisma db seed` (not the raw `seed` script) is used so the Prisma CLI loads the
`.env` before running `tsx src/seed.ts`.

## Verified on first connect (2026-08-13)
52 tables, `pg_trgm` present, 8 sequences, seeded institution, write/read/delete
round-trip OK.

## Still needed for full production
- **Redis** for the BullMQ worker — Neon is Postgres only. Use Upstash (serverless)
  or Redis Cloud and set `REDIS_URL`. Not required for the web app's read/write paths.
- **Postgres version** — local dev targets PG 18; Neon runs PG 17. Nothing in the
  schema is PG18-specific, so this is informational only.
- **Rate-limit / circuit-breaker state** is in-process (single instance). For
  multi-instance deploys, back the `RateLimitStore` with Redis (interface ready).
