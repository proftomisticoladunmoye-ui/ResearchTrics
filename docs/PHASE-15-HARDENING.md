# Phase 15 — Hardening: Security Review, Rate Limiting, Circuit Breakers, Anti-Fraud

> **Status:** Implemented and validated (incl. real-DB smoke). Awaiting review.
> The final roadmap slice: a security review of the whole surface plus the abuse
> controls deferred from the Discovery Engine (§32 claim-token rate limiting /
> enumeration hardening, §33 rapid-claim / duplicate-account / fake-domain
> detection) and Spec §35 (rate limits, circuit breakers, security headers).
> Offline-validated — **no production database is connected.**

## Delivered

### Core (pure, injectable-clock, unit-tested)
- **`rate-limit.ts`** — a fixed-window `RateLimiter` with an injectable clock and
  a pluggable `RateLimitStore` (`MemoryRateLimitStore` default; a Redis/Postgres
  store implementing the same interface is the production swap — the search /
  federation provider-abstraction pattern, so nothing presumes a DB). Named
  `RATE_LIMITS` for login, register, claim, invite, import, public API. Emits a
  `retryAfterSeconds` grounded in the real window reset.
- **`circuit-breaker.ts`** — a `CircuitBreaker` (closed → open → half-open) with
  an injectable clock, failure/success thresholds, and a cooldown; a shared
  registry so one provider name maps to one breaker. Fails fast with
  `CircuitOpenError` while open; a failed half-open probe re-opens immediately.
- **`anti-fraud.ts`** (§33) — pure detectors (`isDisposableEmail`,
  `isFreeWebmail`, `looksInstitutional`) over explicit, auditable domain lists,
  plus grounded async `assessClaimRisk` combining: disposable-email, free-webmail
  (weak — proves mailbox control, not institutional identity, §13), rapid-claim
  **velocity** (counted from real claim rows), and **contested-profile** pressure
  (real pending invitations). Returns an advisory `RiskAssessment`
  (`low`/`elevated`/`high` + `requiresReview`). `recordSecurityEvent` appends to
  the audit log without ever breaking the primary flow.

### Web wiring
- **`middleware.ts`** — security headers on every response: CSP, `X-Frame-Options: DENY`,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`,
  `Cross-Origin-Opener-Policy`, and HSTS (production only — never forced on dev).
- **`lib/rate-limit.ts`** — `enforceRateLimit` throws a `RATE_LIMITED` (429); the
  `fail` envelope now sets a `Retry-After` header. `clientIp` keys throttling only.
- **Routes**: `login` (per-IP + per-email), `register` (per-IP), `claim`
  (per-user **+ anti-fraud**: high/elevated risk is held for manual review and a
  security event recorded, instead of auto-completing), `invite` (per-user),
  `publications/import` (per-user).
- **`/admin/sources`** now shows each provider's **circuit** state; the federation
  health probe routes through a per-provider breaker so a persistently failing
  source trips OPEN and fails fast (the same breaker guards live ingestion).

## Security review (findings + disposition)
- **Auth / sessions** — sessions are opaque random tokens; only the SHA-256 hash
  is stored; HttpOnly + SameSite=Lax + Secure-in-prod cookies; rotation on
  privilege change. *No finding.* Rate limiting on login added (was missing).
- **Secrets at rest** — OAuth tokens envelope-encrypted (AES-256-GCM), never sent
  to the frontend. *No finding.*
- **Error handling** — `toProblem` never leaks internals; 500s are logged, not
  echoed. *No finding.*
- **Abuse surface** — credential stuffing, account-creation spam, claim/referral
  abuse, and outbound-lookup abuse now rate-limited (were open). **Fixed.**
- **Claim integrity** — a typed ORCID still cannot claim (§12); high-risk claims
  now route to review rather than auto-associating (§33). **Fixed.**
- **Transport / headers** — CSP + HSTS + clickjacking/MIME guards added (were
  absent). **Fixed.** CSP still allows `'unsafe-inline'` scripts (Next.js App
  Router inlines bootstrap without a per-request nonce here) — **documented
  follow-up** to move to nonces.
- **Identity honesty** — unchanged and intact: RVM stays labelled a prototype
  pending validation; nothing asserts "this is you" before verification (§68).

## Validation results
- **Tests:** 90 existing + **20 new** (rate-limit 6, circuit-breaker 6,
  anti-fraud 8) = 110 core unit tests pass.
- **Type-check / Lint:** clean across all packages (sequential).
- **Real-DB smoke:** **102/102** (+5: rate limiter allow-then-block; breaker
  open→fail-fast→half-open; disposable-email = high-risk/review; institutional
  email = low-risk; security event appended to audit log).
- **Build:** web app builds with the middleware + updated routes.

## Integrity notes
- Every anti-fraud signal is derived from data that actually exists; a high score
  **flags for review**, it never fabricates guilt, accuses, or hard-deletes.
- Rate-limit decisions reflect only recorded counts; the limiter is deterministic.
- Security events are append-only and advisory.

## Deferred (documented)
- Distributed rate-limit + breaker state (Redis) — the interfaces are in place;
  the in-memory store is correct for a single instance / offline smoke.
- CSP script nonces (remove `'unsafe-inline'` for scripts).
- Optional MFA/TOTP enforcement (`User.mfaEnabled`/`mfaSecret` columns exist).
- Persisted security-event dashboard in `/admin` (events already land in the
  audit log).

## Exit gate
A reviewed security surface with rate limiting, circuit breakers, security
headers, and grounded anti-fraud on the claim path; offline-validated. **Phase 15
complete. STOP FOR REVIEW.**
