# Phase D3 — Profile Claiming & Verification (Implementation Notes)

> **Status:** Implemented and validated (incl. real-DB smoke). Awaiting review.
> The §67 end-to-end slice: discovered → public unclaimed profile → claim → verification → publication claiming. The live ORCID OAuth round-trip needs real ORCID credentials to exercise; the claim/verify **logic** is validated offline.

## Delivered

### Core — `claiming.ts`
- **`registerClaimant`** — creates a user account **without** a researcher (the account you make to *claim* a discovered profile), with the default researcher role.
- **`startClaim`** / **`claimProfile`** (§11, §12, §13) — completes a claim only on real evidence:
  - **ORCID**: the discovered profile must already carry the *same* ORCID; a typed/mismatched ORCID **never** claims (§12). → `profileStatus: verified`, level 3.
  - **Institutional email**: proves control of the account/email (§13). → `profileStatus: claimed`, level 2.
  - Guards: profile must be unclaimed and unowned; a user who already owns a different researcher is redirected to the (future) **merge** flow (§24) rather than silently double-claiming. Links `userId`, marks the ORCID identifier verified, writes a `VerificationRecord` + audit.
- **`setPublicationClaim`** (§14, §15) — `claimed` associates the researcher with the authorship; `disputed` removes **only their** association and **keeps the global scholarly record**. Plus `listResearcherPublicationClaims`.
- **`requestProfileRemoval`** (§35) — opt-out for an unclaimed profile: suppresses it and records a minimal suppression so future syncs never recreate it. Claimed profiles are owner-managed and out of scope here.

### Web (`apps/web`)
- **`/researchers/[slug]`** — an **Unclaimed profile** banner with "Is this your research profile?" → **Claim this profile** and a "This isn't me" link. Person JSON-LD structured data already present (§30, §31); unclaimed public profiles stay indexable.
- **`/researchers/[slug]/claim`** — the claim page: sign-in / create-account gate, the merge notice for accounts that already own a profile, ORCID-recommended messaging, and **Verify & claim** / **Request removal** actions.
- **`/dashboard/claim-publications`** — confirm/dispute candidate publications (name-matched unclaimed authorships) and dispute already-claimed ones.
- **APIs** — `POST /researchers/[id]/claim` (institutional method only client-side; ORCID reserved for the OAuth callback so a typed ORCID can't claim), `.../removal`, `.../publications/[pubId]/claim` (owner-only).

## Validation results
- **Tests:** 102 passing (unchanged — claim logic is DB-bound, covered by smoke).
- **Type-check / Lint:** clean across all packages (sequential).
- **Real-DB smoke:** 71/71 — +7 claim checks: a user with an existing profile **cannot** claim another (§24); a **mismatched ORCID never claims** (§12); an ORCID-verified claim marks the profile **VERIFIED** and links the account (§68); publication **claim** recorded and **dispute keeps the global record** (§15); **removal suppresses** an unclaimed profile (§35).

## Integrity notes (§12, §15, §35, §68)
- Ownership is never asserted before verification; a typed ORCID cannot claim a profile.
- Disputes are per-researcher and never delete the global scholarly record.
- Removal suppresses and prevents recreation.

## Deferred (documented)
- **Live ORCID OAuth claim callback** — the service accepts a server-verified ORCID; wiring the OAuth round-trip for claiming (distinct from the existing per-researcher ORCID connection) needs a configured ORCID app + callback and is exercised only with real credentials.
- **Merge flow** for a user who already owns a researcher (§24, §57) — surfaced with a clear notice; lands in D4's review queue.
- Full institutional-domain proof (emailed code to `researcher@university.edu`); D3 uses the authenticated account email as evidence.
- Auto-import of discovery-sourced works as candidate publications (enrichment); publication claiming operates on name-matched authorships today.

## Exit gate
Public unclaimed profile with a claim CTA, an evidence-based claim + verification flow (ORCID/institutional), publication claim/dispute that preserves the global record, and opt-out removal; verified against a live database. **STOP FOR REVIEW.**
