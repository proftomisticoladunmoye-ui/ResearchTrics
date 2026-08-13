# Phase D1 — Researcher Discovery: Foundation (Implementation Notes)

> **Status:** Implemented and validated (incl. real-DB smoke). Awaiting review.
> First slice of the Researcher Discovery, Identity Resolution & Profile Claiming Engine. Offline / fixture-validated per §67 — live sources arrive in D2.

## Delivered

### Data model (`packages/db`) — migration → **48 tables**
- `Researcher.profileStatus` (`ProfileStatus` enum: discovered → … → verified/suppressed; existing accounts default `claimed`), `identityConfidence` (Int, **distinct from RVM** §26), `discoverySource`.
- **`ResearcherSource`** — per-field provenance (source/sourceId/sourceUrl/retrievedAt/lastSyncedAt/confidence/payload) (§5, §36).
- **`ClaimInvitation`** — hashed single-use claim tokens with channel/status/expiry (§17, §18, §32).
- **`ResearcherPublicationClaim`** — per-researcher claim/dispute (§14, §15).
- **`ProfileSuppression`** — opt-out records that prevent recreation (§35).
- **`DiscoveryRun`** — bulk-run tracking for the admin dashboard (§22, §23, §40).

### `packages/discovery` (new, self-contained, offline)
- **`ResearcherDiscoveryProvider`** interface + `DiscoveredResearcher` / `DiscoveryProvenance` types (§39). Every candidate carries provenance.
- **`FixtureDiscoveryProvider`** — deterministic, offline dataset for the controlled prototype (§67).
- **`buildIdentityReport`** — explainable, configurable point-scoring (ORCID/institution/co-author/topic/affiliation/name = 100) → confidence + tier (§9, §10, §25). `mayAutoAssociate` refuses association below threshold **and on name evidence alone**. Explicitly **not** the RVM (§26, §54).
- **Claim tokens** — `generateClaimToken`/`hashClaimToken`/`verifyClaimToken` (32-byte random, SHA-256 hashed — raw never stored, constant-time verify, expiry) (§32).

### Core — `discovery.ts`
- **`createProvisionalResearcher`** — creates an **UNCLAIMED** profile (never a verified account, §68), records per-field provenance, mints unverified ORCID/OpenAlex identifiers, is **idempotent on strong identifiers** (no duplicates), and **refuses to recreate a suppressed profile**.
- `isSuppressed` / `recordSuppression` / `nameKeyFor` (§35); `getDiscoveredProfileBySlug` (with provenance).

### Docs
- **`docs/DATA-SOURCE-COMPLIANCE.md`** (§38, §61) — the register of approved sources, hard prohibitions (no ResearchGate/Scholar/LinkedIn/Scopus/WoS scraping), provenance + rate-limit obligations, identity-vs-visibility separation, and a review log. **Required before any live source is wired.**

## Validation results
- **Tests:** 93 passing (+12 discovery: identity report, name-alone guard, tier bands, claim tokens, fixture provider).
- **Type-check / Lint:** clean across all packages (sequential).
- **Real-DB smoke:** 61/61 — discovery yields provenance-bearing candidates; a provisional profile is created **UNCLAIMED with no account**; provenance rows recorded; identity confidence (95, very_high) is **explained and separate from RVM**; re-discovery is **idempotent on ORCID**; **suppression blocks recreation**; claim tokens verify and reject wrong tokens.

## Integrity notes (§26, §35, §54, §68)
- Identity confidence and RVM are separate constructs and never combined.
- Discovered profiles are UNCLAIMED, never presented as verified — ownership requires the researcher (D3).
- Every discovered field is provenance-backed; suppressed profiles are never recreated.
- No live external calls in this slice; only legitimate sources will be wired in D2, and only after compliance review.

## Next (D2)
Live OpenAlex/Crossref/ORCID discovery providers (config-gated, fixture-tested offline), admin "Discover researchers", and bulk background jobs (§22–§23, §52, §59–§60).

## Exit gate
Discovery provider abstraction + offline fixture provider; explainable identity resolution distinct from RVM; provisional unclaimed profiles with provenance, idempotency, and suppression; secure claim tokens; source-compliance register. **STOP FOR REVIEW.**
