/**
 * Rate limiting (Phase 15 hardening, Spec §35 abuse controls).
 *
 * A fixed-window counter with an injectable clock and a pluggable store. The
 * default store is in-process (single-instance / tests / offline smoke). A
 * production deployment swaps in a Redis- or Postgres-backed store implementing
 * the same {@link RateLimitStore} interface — exactly the provider-abstraction
 * pattern used for search and scholarly metadata, so nothing here presumes a
 * connected database.
 *
 * The limiter is deterministic: given the same clock and store it always yields
 * the same decision. No behaviour is fabricated — a decision reflects only the
 * counts actually recorded.
 */

export interface RateLimitRule {
  /** Maximum number of hits permitted within the window. */
  readonly limit: number;
  /** Window length in milliseconds. */
  readonly windowMs: number;
}

export interface RateLimitDecision {
  /** Whether this hit is permitted. */
  readonly allowed: boolean;
  /** Hits remaining in the current window after this call (never negative). */
  readonly remaining: number;
  /** Epoch ms at which the current window resets. */
  readonly resetAt: number;
  /** When blocked, seconds the caller should wait before retrying. */
  readonly retryAfterSeconds: number;
}

interface WindowState {
  count: number;
  /** Epoch ms at which this window resets. */
  resetAt: number;
}

/**
 * Storage for per-key window counters. Implementations MUST be safe to call
 * concurrently; the in-memory default is single-threaded per Node process.
 */
export interface RateLimitStore {
  /** Read the current window for a key, or undefined if none/expired. */
  get(key: string): WindowState | undefined | Promise<WindowState | undefined>;
  /** Persist the window for a key. */
  set(key: string, state: WindowState): void | Promise<void>;
}

/**
 * Default in-process store. It is a dumb key→window map: window *expiry* is the
 * limiter's job (the limiter owns the clock and opens a fresh window when the
 * stored one has elapsed), so the store never prunes on its own wall clock —
 * that would desync from an injected test clock. `prune(now)` is offered for
 * optional memory hygiene; a production Redis store would use native TTL.
 */
export class MemoryRateLimitStore implements RateLimitStore {
  private readonly map = new Map<string, WindowState>();

  get(key: string): WindowState | undefined {
    return this.map.get(key);
  }

  set(key: string, state: WindowState): void {
    this.map.set(key, state);
  }

  /** Drop windows that have reset at or before `now` (memory hygiene). */
  prune(now: number = Date.now()): void {
    for (const [key, state] of this.map) {
      if (state.resetAt <= now) this.map.delete(key);
    }
  }

  /** Test/maintenance helper — drop all counters. */
  clear(): void {
    this.map.clear();
  }
}

export interface RateLimiterOptions {
  store?: RateLimitStore;
  /** Injectable clock (defaults to Date.now) for deterministic tests. */
  now?: () => number;
}

export class RateLimiter {
  private readonly store: RateLimitStore;
  private readonly now: () => number;

  constructor(options: RateLimiterOptions = {}) {
    this.store = options.store ?? new MemoryRateLimitStore();
    this.now = options.now ?? (() => Date.now());
  }

  /**
   * Record one hit against `key` under `rule` and return the decision. The
   * window is fixed: it opens on the first hit and resets `windowMs` later.
   */
  async hit(key: string, rule: RateLimitRule): Promise<RateLimitDecision> {
    const now = this.now();
    const existing = await this.store.get(key);
    const window: WindowState =
      existing && existing.resetAt > now ? existing : { count: 0, resetAt: now + rule.windowMs };

    if (window.count >= rule.limit) {
      // Over the limit — do not increment further; report retry timing.
      return {
        allowed: false,
        remaining: 0,
        resetAt: window.resetAt,
        retryAfterSeconds: Math.max(1, Math.ceil((window.resetAt - now) / 1000)),
      };
    }

    window.count += 1;
    await this.store.set(key, window);
    return {
      allowed: true,
      remaining: Math.max(0, rule.limit - window.count),
      resetAt: window.resetAt,
      retryAfterSeconds: 0,
    };
  }
}

/**
 * Named rules for sensitive actions (Spec §35). Conservative defaults; tune per
 * deployment. Windows are short enough to blunt automated abuse without
 * penalising legitimate bursts.
 */
export const RATE_LIMITS = {
  /** Credential submission — blunt brute force (per IP + per email). */
  login: { limit: 8, windowMs: 5 * 60_000 },
  /** Account creation per IP. */
  register: { limit: 5, windowMs: 60 * 60_000 },
  /** Profile claim attempts per user. */
  claim: { limit: 5, windowMs: 60 * 60_000 },
  /** Invitations/referrals sent per user. */
  invite: { limit: 20, windowMs: 60 * 60_000 },
  /** Publication import-by-DOI per user. */
  importDoi: { limit: 60, windowMs: 60 * 60_000 },
  /** File uploads per user. */
  upload: { limit: 40, windowMs: 60 * 60_000 },
  /** Anonymous read-heavy API per IP. */
  publicApi: { limit: 120, windowMs: 60_000 },
  /** AI Assistant generations per user — bounds external-provider cost/abuse. */
  assistant: { limit: 30, windowMs: 10 * 60_000 },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitName = keyof typeof RATE_LIMITS;

/** A process-wide limiter suitable for a single instance / offline smoke. */
export const defaultRateLimiter = new RateLimiter();

/**
 * Convenience: apply a named rule to a caller key (e.g. `login:ip:1.2.3.4`).
 * Uses the process-wide limiter unless one is supplied.
 */
export function checkRateLimit(
  name: RateLimitName,
  callerKey: string,
  limiter: RateLimiter = defaultRateLimiter,
): Promise<RateLimitDecision> {
  return limiter.hit(`${name}:${callerKey}`, RATE_LIMITS[name]);
}
