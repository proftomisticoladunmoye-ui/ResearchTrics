# ResearchTrics

**Make Research Visible. Discoverable. Connected. Measurable.**

ResearchTrics is a global research visibility infrastructure platform — researcher identity, scholarly outputs, research intelligence, discovery, collaboration, and the **Research Visibility Metric (RVM)**.

> **Build status:** Phase 1 (Foundation) in progress. See [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Architecture

Full architecture in [`docs/`](docs/):

- [MASTER-ARCHITECTURE.md](docs/MASTER-ARCHITECTURE.md)
- [DATABASE-ARCHITECTURE.md](docs/DATABASE-ARCHITECTURE.md)
- [INTEGRATION-ARCHITECTURE.md](docs/INTEGRATION-ARCHITECTURE.md)
- [RVM-FRAMEWORK.md](docs/RVM-FRAMEWORK.md)
- [ROADMAP.md](docs/ROADMAP.md)

## Tech stack

TypeScript (strict) · Next.js (App Router) · PostgreSQL 16 + Prisma · Redis + BullMQ · S3/MinIO object storage · Auth.js + custom RBAC · Tailwind + Radix UI · Vitest + Playwright.

## Monorepo layout

```
apps/
  web/         Next.js: public SSR pages, dashboards, /api/v1
  worker/      BullMQ background processors
packages/
  config/      Brand tokens, env schema, constants
  contracts/   Zod schemas + shared types
  db/          Prisma schema, client, seed
  core/        Domain services (auth, RBAC, RTX ID, logging, errors)
  ui/          Design system components
docker/        Dockerfiles + docker-compose (postgres, redis, minio, ojs)
docs/          Architecture documentation
```

## Getting started (local dev)

Prerequisites: Node ≥ 20, pnpm 9, Docker (for the service stack).

```bash
pnpm install
cp .env.example .env          # fill in values
docker compose -f docker/docker-compose.yml up -d   # postgres, redis, minio, ojs
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Run all apps in dev mode |
| `pnpm build` | Build all packages/apps |
| `pnpm lint` | Lint the workspace |
| `pnpm typecheck` | Type-check the workspace |
| `pnpm test` | Run tests |
| `pnpm db:migrate` | Apply Prisma migrations |

## Security & integrity

Secrets are never committed; OAuth tokens are encrypted at rest. Scholarly records are non-destructive and audited. RVM is a transparent, **proprietary framework pending empirical validation** — it is not presented as validated. See the architecture docs for the full trust and provenance model.

## License

Proprietary — © ResearchTrics. All rights reserved.
