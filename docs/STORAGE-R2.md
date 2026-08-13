# Object storage — Cloudflare R2

ResearchTrics stores uploaded files (PDFs, images, datasets) in **S3-compatible
object storage** — never blobs in Postgres (Spec §46). The production target is
**Cloudflare R2** (S3 API, no egress fees). The provider is selected at boot:
when the `OBJECT_STORAGE_*` vars are set the app uses the S3 provider, otherwise
it falls back to the local-filesystem provider — so dev needs no bucket.

## How it's wired
- `packages/core/src/storage-s3.ts` — `S3StorageProvider` (put / urlFor /
  signedGetUrl / exists / delete) + `s3ConfigFromEnv` + `storageFromEnv`.
- `apps/web/src/instrumentation.ts` — `register()` runs `storageFromEnv()` once
  at server boot and installs the provider.
- R2-safe client config: `forcePathStyle`, region `auto`, and
  `requestChecksumCalculation: WHEN_REQUIRED` (avoids R2 rejecting the AWS SDK's
  default flexible checksums).

## Create the bucket + token (Cloudflare dashboard)
1. **R2 → Create bucket** → name it `researchtrics` (or your choice).
2. **R2 → Manage R2 API Tokens → Create API token**:
   - Permission: **Object Read & Write**, scoped to that bucket.
   - Copy the **Access Key ID** and **Secret Access Key** (shown once).
3. Note your **Account ID** (R2 overview) — the endpoint is
   `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`.
4. (Optional, for public files) enable a **custom domain** or the **r2.dev**
   public URL on the bucket → use it as `OBJECT_STORAGE_PUBLIC_URL`.

## Environment variables
| Var | R2 value |
|---|---|
| `OBJECT_STORAGE_ENDPOINT` | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` |
| `OBJECT_STORAGE_REGION` | `auto` |
| `OBJECT_STORAGE_BUCKET` | `researchtrics` |
| `OBJECT_STORAGE_KEY` | API token Access Key ID |
| `OBJECT_STORAGE_SECRET` | API token Secret Access Key |
| `OBJECT_STORAGE_FORCE_PATH_STYLE` | `true` |
| `OBJECT_STORAGE_PUBLIC_URL` | custom-domain / r2.dev URL (optional) |

Set these in `packages/db/.env` locally (gitignored) or the Render
`researchtrics-secrets` group in production.

## Access model
- **Public objects** (open-access research files): if `OBJECT_STORAGE_PUBLIC_URL`
  is set, `urlFor(key)` returns a direct public URL.
- **Private / access-controlled objects**: `urlFor(key)` returns the app's
  `/api/v1/files/<key>` route (to be served with `signedGetUrl` behind an
  access check). The presigner is implemented; the file-serving route + upload
  endpoint are a documented follow-up (upload is not yet wired into a route).

## Deferred (documented)
- `GET /api/v1/files/[key]` serving route (stream / redirect to a presigned URL
  with an access-level check) and the upload endpoint that calls `storeFile`.
