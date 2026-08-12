# Phase 2 — Researcher Identity (Implementation Notes)

> **Status:** Implemented and validated (lint / typecheck / tests / build green). Awaiting review before Phase 3.

Delivers authoritative researcher identity: profiles, institutions & affiliations, ORCID OAuth verification, verification levels, email verification, and confidence-based identity matching.

## Delivered

### Data model (`packages/db`)
New models: `ResearchInterest`, `VerificationRecord`, `OrcidConnection` (encrypted tokens), `VerificationToken` (single-use email/reset). Researcher gains `website` + `photoUrl`. Aligned with [`DATABASE-ARCHITECTURE.md`](./DATABASE-ARCHITECTURE.md).

### Core services (`packages/core`)
- **Profile**: `getResearcherBySlug` / `getResearcherByUserId` (public include), `updateProfile` (audited, allowed-fields only), `setInterests`, `listResearchers` (search + paginate, public-only).
- **Institution/affiliation**: `listInstitutions`, `getInstitutionBySlug`, `findOrCreateInstitutionByName`, `addAffiliation` (single-primary invariant), `removeAffiliation`.
- **Verification** (Spec §38): `issueEmailVerification` + `verifyEmailToken` (→ Level 1), `setVerificationLevel` (never lowers; always records + audits).
- **Identity matching** (Spec §58): `computeMatchConfidence` + `nameSimilarity` (normalized Levenshtein). ORCID is decisive; **name alone never reaches "strong"**; every result carries explanations.
- **Email**: provider abstraction + `ConsoleEmailProvider` + verification template (Spec §40, §48).

### ORCID integration (`packages/integration-orcid`)
Full connect/verify flow with encrypted tokens, CSRF state, ownership guard, Level-3 verification, and minimal public-profile import (empty-fields-only + provenance). See [`ORCID-INTEGRATION.md`](./ORCID-INTEGRATION.md). Endpoints env-selected (sandbox default), to be re-verified against official docs before production (Spec §93).

### Web (`apps/web`)
- **Public, crawlable** `/researchers` (search + pagination) and `/researchers/[slug]` — profile header, RTX id, verification + ORCID badges, snapshot, interests, affiliations, external identifiers, **`Person` JSON-LD + canonical + OG** (SEO groundwork). Visibility enforced (private profiles owner/admin-only).
- `/institutions` + `/institutions/[slug]` (researchers + departments).
- `/dashboard/profile` — profile editor (client form → `PATCH /api/v1/researchers/me`), ORCID connect, verification status.
- `/verify-email` status page.
- API: `PATCH /api/v1/researchers/me`, `GET /api/v1/integrations/orcid/connect` + `/callback`, `GET /api/v1/auth/verify-email`. Registration now dispatches a verification email (best-effort).

## Validation results
- **Tests:** 28 passing (core 22 incl. matching; orcid 3; config 3).
- **Type-check / Lint / Build:** clean across all 7 packages.

## Security & integrity notes
- ORCID tokens encrypted at rest, never exposed to the client; CSRF-protected callback.
- Profile updates go through the RBAC ownership gate (`researcher:update:self`).
- Verification levels honestly labelled; every change audited (Spec §38, §68).
- External imports fill empty fields only and write provenance (Spec §84, §85).

## Deferred within the phase (documented)
- Works/publications import from ORCID → Phase 3 (publication engine).
- Institution *verification* approval UI (Level 2) → schema + `setVerificationLevel` ready; admin approval flow lands with the admin console / Phase 12.
- Real email transport (Resend/Postmark/SES) → provider abstraction ready; console provider used for now.
- Manual affiliation management UI on the dashboard → service ready; a form is a small Phase-3 add.

## Exit gate
Researcher can register → receive RTX id → verify email (Level 1) → connect+verify ORCID (Level 3) → edit profile + interests → appear on a public, crawlable profile and institution pages. Matching never auto-merges below threshold. **STOP FOR REVIEW** before Phase 3 (Publication Engine).
