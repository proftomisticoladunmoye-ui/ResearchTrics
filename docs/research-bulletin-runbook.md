# ResearchTrics — Operator Runbook

Everything needed to deploy and operate ResearchTrics, with a focus on the
**Research Bulletin** scholarly-publishing engine. Written for whoever manages
the Render deployment.

> **Golden rules**
> - Never put a secret in this file or in git. Values below are placeholders.
> - Env vars set on Render trigger a redeploy of the **pinned** commit — after
>   changing env, always **Manual Deploy → Deploy latest commit**.
> - Set vars on the correct service: **web** serves pages/APIs; **worker** runs
>   background jobs. Some belong on both.
> - Database migrations 1–14 are already applied to Neon. New migrations must be
>   applied with `prisma migrate deploy` before the code that needs them runs.

---

## 1. Services & platform

| Piece | Where | Notes |
|---|---|---|
| Web app (Next.js) | Render web service | Public site + APIs + admin |
| Worker (BullMQ) | Render worker | Digests, discovery, citation refresh, AI summaries |
| Database | Neon (Postgres) | `DATABASE_URL` (pooled) + `DIRECT_URL` (migrations) |
| Object storage | Cloudflare R2 | Uploaded files + bulletin images |
| Email | Resend | Verification, digests, admin test |
| Cache/queue | Render Key-Value (Redis) | `REDIS_URL` (worker; web enqueues) |

---

## 2. Environment variables

### 2.1 Core (required, both services)
| Var | Example | Notes |
|---|---|---|
| `DATABASE_URL` | `postgresql://…-pooler.…/neondb` | Neon **pooled** URL |
| `DIRECT_URL` | `postgresql://….neon.tech/neondb` | Neon **direct** (migrations) |
| `SESSION_SECRET` | 32+ random bytes | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `TOKEN_ENCRYPTION_KEY` | base64 of 32 bytes | `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `NEXT_PUBLIC_APP_URL` | `https://www.researchtrics.com` | Canonical host — **use the same host everywhere** (see ORCID) |
| `REDIS_URL` | `redis://…` | Worker; web for enqueue |

### 2.2 Object storage — R2 (web + worker)
| Var | Example |
|---|---|
| `OBJECT_STORAGE_ENDPOINT` | `https://<acct>.r2.cloudflarestorage.com` |
| `OBJECT_STORAGE_BUCKET` | `researchtrics` |
| `OBJECT_STORAGE_KEY` / `OBJECT_STORAGE_SECRET` | R2 access key / secret |
| `OBJECT_STORAGE_REGION` | `auto` (default) |
| `OBJECT_STORAGE_PUBLIC_URL` | *(optional)* public bucket base URL |

Verify: `GET /api/v1/health?storage=1` → `checks.storage.ok: true`.

### 2.3 Email — Resend (web; worker for digests)
| Var | Example | Notes |
|---|---|---|
| `EMAIL_PROVIDER` | `resend` | else console (nothing sent) |
| `EMAIL_API_KEY` | `re_…` | |
| `EMAIL_FROM` | `ResearchTrics <no-reply@update.researchtrics.com>` | **domain must be verified in Resend** |
| `EMAIL_DIGESTS_ENABLED` | `true` | worker only, optional |

Verify: admin **Send test email** button, or the profile **Send verification email**.

### 2.4 AI Assistant (web)
| Var | Example | Notes |
|---|---|---|
| `AI_PROVIDER` | `openrouter` | or `claude` / `local` |
| `AI_API_KEY` | `sk-or-…` | must be **`AI_API_KEY`**, not `OPENROUTER_API_KEY` |
| `AI_MODEL` | `anthropic/claude-sonnet-4.6` | **slug only** — no `AI_MODEL=` prefix, no quotes |
| `AI_BASE_URL` | *(optional)* gateway override | |
| `AI_SUMMARIES_ENABLED` | `true` | worker precompute, optional |

### 2.5 ORCID (web) — optional
| Var | Example |
|---|---|
| `ORCID_CLIENT_ID` / `ORCID_CLIENT_SECRET` | from orcid.org/developer-tools |
| `ORCID_REDIRECT_URI` | `https://www.researchtrics.com/api/v1/integrations/orcid/callback` |
| `ORCID_ENVIRONMENT` | `production` (or omit for sandbox) |
| `ORCID_ENABLE_WORK_SYNC` | `true` — enables pushing works into ORCID (needs **member** API) |

**Host consistency is critical:** the redirect URI registered at ORCID,
`ORCID_REDIRECT_URI`, and `NEXT_PUBLIC_APP_URL` must all use the **same host**
(the `www` one). A mismatch drops the CSRF cookie → "could not be verified".
Enabling work sync requires existing users to **reconnect** (to grant the
`/activities/update` scope).

### 2.6 DOI minting for bulletins — Zenodo (preferred, free) OR DataCite
Zenodo (web) — free, no membership:
| Var | Example |
|---|---|
| `ZENODO_TOKEN` | personal access token, scopes `deposit:write` + `deposit:actions` |
| `ZENODO_ENVIRONMENT` | `production` (or omit for sandbox) |

DataCite (web) — alternative, needs membership + prefix:
`DATACITE_ENDPOINT`, `DATACITE_REPOSITORY_ID`, `DATACITE_PASSWORD`, `DATACITE_PREFIX`.

Provider precedence: **Zenodo → DataCite → none**. A DOI is only ever shown once
actually registered.

### 2.7 Research Bulletin series & comments (web)
| Var | Example | Notes |
|---|---|---|
| `BULLETIN_COMMENTS_ENABLED` | `true` | moderated discussion; OFF by default |
| `BULLETIN_ISSN` / `BULLETIN_EISSN` | `1234-5678` | **only** a real, registered ISSN — never invent |
| `BULLETIN_FREQUENCY` | `Continuous` | optional |
| `BULLETIN_LANGUAGE` | `en` | optional |
| `BULLETIN_COUNTRY` | `NG` | optional |

### 2.8 Citation refresh & discovery (worker)
| Var | Example | Notes |
|---|---|---|
| `CITATION_REFRESH_ENABLED` | `true` (default) | daily OpenAlex refresh; set `false` to disable |
| `CITATION_REFRESH_BATCH` / `CITATION_REFRESH_STALE_DAYS` | `200` / `7` | tuning |
| `OPENALEX_MAILTO` | `you@researchtrics.com` | OpenAlex polite pool |
| `DISCOVERY_SEED` | `country:NG,topic:psychometrics` | optional global discovery |
| `OPPORTUNITY_INGEST_SOURCES` | `grants_gov` | only sources whose terms you've reviewed |

---

## 3. Deploy checklist
1. Set/confirm env vars (§2) on the correct service(s).
2. Apply any new DB migrations: `pnpm --filter @researchtrics/db exec prisma migrate deploy` (uses `DIRECT_URL`).
3. **Render → web → Manual Deploy → Deploy latest commit** (and enable Auto-Deploy).
4. Repeat for the **worker**.
5. Smoke-check: `GET /api/v1/health?storage=1` (db + storage), load `/research-bulletin`, open a published bulletin.

---

## 4. Publishing a Research Bulletin
1. **Admin → `/admin/research-bulletin/new`.**
2. Either author in the editor, or **Import from Word (.docx)** and review the import report (headings/images/references + warnings).
3. Fill title, type, category, keywords, abstract, authors, references. Add internal citations with the **"Cite another Research Bulletin"** picker (inserts a link at the cursor).
4. **Create draft** → **Publish**. Readiness checks must pass (title, ≥1 author, abstract ≥40 chars, ≥1 keyword, category, content ≥200 chars, ≥1 reference). Publishing assigns the **permanent number** (once) + date.
5. On the published bulletin: **Download PDF** works; article emits `citation_*` + JSON-LD + canonical.
6. **Mint DOI** (edit page, if Zenodo/DataCite configured) — permanent; deposits the PDF to Zenodo.
7. Group related bulletins: **Collections** (`/admin/research-bulletin/collections`) → create a collection or ordered series → add members.

Re-publishing keeps the same number and re-syncs internal citation edges (adds/prunes "Cited by").

---

## 5. Comments moderation
- Enable with `BULLETIN_COMMENTS_ENABLED=true`.
- Readers submit on the article; everything is **pending** until approved.
- Moderate at **`/admin/research-bulletin/comments`** (pending/approved/rejected tabs; approve/reject/delete). Email is admin-only, never public.

---

## 6. Google Scholar / indexing checklist
- [ ] Deploy latest commit (crawlable SSR pages).
- [ ] Submit `https://www.researchtrics.com/sitemap.xml` in **Google Search Console** (bulletins are in the `research-bulletin` shard, alongside collections).
- [ ] Confirm a bulletin page returns 200 and its `citation_pdf_url` (`/api/v1/research-bulletin/<slug>/pdf`) serves `application/pdf` inline.
- [ ] Ensure PDFs contain **real text** (image-only PDFs are rejected on upload by design).
- [ ] RSS available at `/research-bulletin/feed.xml`.
- Note: indexing is never guaranteed — this maximises technical eligibility only.

---

## 7. Analytics
- Admin dashboard: **`/admin/research-bulletin/analytics`** — totals, most-viewed/-downloaded/-cited, category/type breakdowns.
- Citation counts shown are **internal** (on-platform, verified). External DOI citations are a future add (activated once bulletins carry DOIs).

---

## 8. Troubleshooting
| Symptom | Likely cause | Fix |
|---|---|---|
| File upload / PDF 404 or error | R2 not configured on web | `GET /api/v1/health?storage=1`; set `OBJECT_STORAGE_*` |
| Verification email not arriving | wrong/no `EMAIL_*`, or `EMAIL_FROM` domain unverified in Resend | set on **web**; verify sender domain |
| AI chat falls back / 400 | `AI_MODEL` malformed or provider unreachable | slug only (no `AI_MODEL=` prefix); check `AI_PROVIDER`/`AI_API_KEY` |
| ORCID "could not be verified" | host mismatch | align registered redirect URI, `ORCID_REDIRECT_URI`, `NEXT_PUBLIC_APP_URL` (all `www`) |
| ORCID work push says "reconnect" | token lacks update scope | user reconnects ORCID after `ORCID_ENABLE_WORK_SYNC=true` |
| DOI mint says "not configured" | no Zenodo/DataCite creds | set `ZENODO_TOKEN` (+ scopes) |
| Re-imported DOI 404s | (fixed) previously soft-deleted work | re-import now restores it automatically |
| Feature "not showing" after deploy | env-triggered redeploy used pinned commit | **Deploy latest commit** |

---

## 9. Important honesty rules (do not violate)
- **Never fabricate** citations, data, DOIs, or an ISSN. A DOI/ISSN is displayed
  only when genuinely registered.
- ISSN cannot be generated in software — it is granted by the ISSN International
  Centre. Barcode tools only render a barcode from an ISSN you already hold.
- AI assistance never invents references/results; verify before use.
