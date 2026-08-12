# Phase 1 — Foundation (Implementation Notes)

> **Status:** Implemented, validated (lint / typecheck / tests / build all green). Awaiting review before Phase 2.

This phase delivers the skeleton every later phase stands on. Nothing here pre-empts later domain work; it establishes structure, identity, auth, RBAC, the design system, and the build/ops baseline.

## Delivered

### Monorepo & tooling
- **pnpm workspaces + Turborepo** (`apps/*`, `packages/*`).
- Shared strict **TypeScript** base (`tsconfig.base.json`), **ESLint 9 flat config**, **Prettier**, **.editorconfig**, **.npmrc**.
- **CI** (`.github/workflows/ci.yml`): install → prisma generate → lint → typecheck → test → build.
- `.env.example` with the full config surface; secrets never committed.

### `packages/config` — brand + env
- Brand **design tokens** (Spec §3, §96) as the single source of truth + a **Tailwind preset** consuming them (no raw hex in components).
- **Zod** server-env schema with readable failure messages.
- Platform constants: RTX id format, output-id prefixes, verification levels, match thresholds, visibility levels.

### `packages/db` — data layer
- **Prisma schema** for Phase 1 tables: `users`, `sessions`, `user_roles`, `researchers`, `researcher_identifiers`, `researcher_name_variants`, `institutions`, `departments`, `affiliations`, plus the provenance/audit spine (`external_records`, `audit_logs`). Aligned with [`DATABASE-ARCHITECTURE.md`](./DATABASE-ARCHITECTURE.md).
- `init.sql`: `pg_trgm` extension + the `researcher_rtx_seq` sequence backing persistent RTX identities.
- Prisma client singleton + `nextResearcherSerial()`; idempotent seed.

### `packages/core` — domain services
- **RTX identity** formatting (`RTX-00000001`) + slug helpers (pure, unit-tested).
- **Argon2id** password hashing; **AES-256-GCM** envelope encryption for OAuth tokens at rest; SHA-256 session-token hashing.
- **Server-side sessions** (create / validate / rotate / revoke) — raw token returned once, only its hash stored.
- **RBAC gate** `authorize(actor, permission, resource)` with an ABAC seam: ownership (`:self`/`:any`) and tenant isolation (Spec §49).
- **Account service**: `registerResearcher` (mints RTX + user + role + audit atomically) and `authenticate`.
- Centralized **error taxonomy** + client-safe problem mapping; **Pino** logger with secret redaction.

### `packages/ui` — design system
- Accessible, brand-tokened components: `Button`, `Input`/`Field`, `Card`/`MetricCard`, `Badge`, `Alert`, `Avatar`, the **ResearchTrics `Logo`** wordmark (Spec §81), and scholarly badges (`OrcidBadge`, `DoiBadge`, `VerificationBadge`, `OpenAccessBadge`). Gold used only as a restrained accent (Spec §3).

### `apps/web` — Next.js (App Router)
- Root layout with skip-link, header nav, footer (Spec §82), SEO metadata + `robots.txt` allowing scholarly crawlers.
- **Landing page** (Spec §54) with an abstract scholarly-network hero (no stock/cliché imagery).
- **Register / Login / Logout** flows wired to `/api/v1/auth/*`; **Dashboard** (auth-gated, shows RTX id).
- `/api/v1/health` (DB connectivity probe); consistent JSON success/error envelopes.

### `apps/worker` — background jobs
- **BullMQ** bootstrap over Redis with the full Phase-73 queue-name contract and default retry/backoff/DLQ options; a working `system.health` processor proving the pipeline.

### `docker/`
- `docker-compose.yml`: Postgres 16, Redis 7, MinIO, and a **fresh OJS 3.4** (+ MariaDB) provisioned per the approved decision; app containers under an `apps` profile. Dockerfiles for web + worker.

## Validation results
- **Tests:** 16/16 passing (`config`, `core`: id, RBAC, crypto).
- **Type-check:** clean across all 6 packages (strict mode).
- **Lint:** clean.
- **Build:** web (10 routes) + worker bundle succeed.

## Notes / deviations
- `packages/contracts` (listed in the master architecture) is **deferred**: Phase 1 uses inline Zod at the route boundary. It will be introduced when cross-service DTOs first need sharing (Phase 3 publication contracts).
- Email verification is scaffolded (flag on `users`) but the send flow lands in Phase 2 with the notification/email system.
- Native `@node-rs/argon2` and `@prisma/client` are externalized from the web webpack bundle and required at runtime.

## Exit gate
App boots, auth works, RBAC enforced, design tokens live, CI pipeline defined and green locally. **STOP FOR REVIEW** before Phase 2 (Researcher Identity + ORCID).
