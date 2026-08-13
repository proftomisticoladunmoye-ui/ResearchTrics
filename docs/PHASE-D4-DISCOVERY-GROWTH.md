# Phase D4 — Discovery Growth & Ops (Implementation Notes)

> **Status:** Implemented and validated (incl. real-DB smoke). Awaiting review.
> Final discovery slice: invitations/referrals, identity review + merge, growth metrics, and the discovery API. Completes the Discovery Engine's acceptance surface (§66) except the anti-fraud/security items, which fold into Phase 15.

## Delivered

### Core
- **`invitations.ts`** (§17–§19, §32) — `createClaimInvitation` (single-use **hashed** token, raw returned once), `createReferral` (colleague invite, §19), `resolveInvitation`, `markInvitationViewed` (funnel, §41), `consumeInvitation` (single-use), `revokeInvitation`. **No unsolicited bulk email** — invitations are created explicitly and delivered by the caller.
- **`review.ts`**:
  - **`listReviewQueue`** (§57) — surfaces same-name profiles (≥1 unclaimed) for **human** review; nothing is auto-merged (name alone is never sufficient, §25).
  - **`mergeResearchers`** (§24) — moves the duplicate's identifiers (conflict-safe), publication claims, interests, name variants, sources, affiliations, and authorships to the canonical profile, then marks the duplicate **`merged`** (never hard-deleted). Audited. Resolves the D3 "account already has a profile" gap.
  - **`discoveryGrowthMetrics`** (§40) — grounded counts by status + source distribution + claimed/verified/suppressed.
  - **`queryDiscoveredResearchers`** (§51) — paginated, filterable (status/source/country/confidence).

### Web (`apps/web`)
- **`/claim/[token]`** (§18) — the invitation landing page: resolves the token, marks it viewed, and shows **Claim my profile** / **This isn't me** (handles invalid/expired/consumed).
- **`/admin/review`** — the identity review queue with per-group **Merge** actions; `POST /api/v1/admin/review/merge` (admin).
- **Growth metrics** cards + source breakdown on `/admin/discovery` (§40).
- **`GET /api/v1/discovery/researchers`** — the paginated, filterable discovery API (admin, §51).
- **Referral** — `POST /api/v1/researchers/[id]/invite` (any signed-in user) returns a one-time claim URL; an "Invite this researcher" button on unclaimed profiles copies it (§19 growth loop).

## Validation results
- **Tests:** 102 unit tests (invitations/merge are DB-bound, covered by smoke).
- **Type-check / Lint:** clean across all packages (sequential).
- **Real-DB smoke:** 80/80 — +9: invitation **issues a token**, **resolves**, a bad token resolves to nothing, is **single-use once consumed**; the review queue **surfaces same-name duplicates**; **merge marks the duplicate merged (not deleted)** and **moves its identifiers to the canonical**; growth metrics count discovered/claimed/verified; the discovery query is paginated.

## Integrity notes (§17, §24, §25, §40)
- No unsolicited bulk email; invitations are explicit and single-use with hashed tokens.
- Merges never hard-delete a profile and are audited; duplicates are only *surfaced* for human review, never auto-merged.
- All growth metrics are grounded counts of real records.

## Deferred (documented → Phase 15 / future)
- Anti-fraud: rapid-claim/duplicate-account/fake-domain detection (§33) and claim-token rate limiting/enumeration hardening (§32) → Phase 15.
- Remaining discovery API endpoints (`/institutions`, `/publications`, `/topics`, §51) — researchers endpoint delivered; others follow the same shape.
- Institution-scoped invitation permissions and ambassador channel UX (§17, §20–§21) — channels/model exist; richer UI later.
- Full conversion/adoption funnel dashboards (§41–§43) — core counts delivered; time-series charts later.

## Exit gate
Claim invitations + referrals with a token landing page, an identity review queue with audited merge, grounded growth metrics, and a paginated discovery API; verified against a live database. **STOP FOR REVIEW.**
