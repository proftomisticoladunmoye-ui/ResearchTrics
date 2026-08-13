/**
 * Circuit breaker for outbound provider calls (Phase 15 hardening).
 *
 * Federation and discovery adapters call third-party scholarly APIs
 * (Crossref/OpenAlex/DataCite/PubMed/ROR). When one starts failing or hanging,
 * repeatedly hammering it wastes time and can trip the upstream's own rate
 * limits. The breaker trips OPEN after a run of failures, fails fast for a
 * cooldown, then probes with a single HALF_OPEN call before restoring service.
 *
 * Deterministic with an injectable clock. It records only what actually
 * happened — a trip reflects real consecutive failures, never a guess.
 */

export type CircuitState = 'closed' | 'open' | 'half_open';

export interface CircuitBreakerOptions {
  /** Consecutive failures that trip the breaker OPEN. */
  failureThreshold?: number;
  /** Cooldown (ms) an OPEN breaker waits before allowing a probe. */
  cooldownMs?: number;
  /** Successful probes required in HALF_OPEN to fully close. */
  successThreshold?: number;
  /** Injectable clock for deterministic tests. */
  now?: () => number;
}

export class CircuitOpenError extends Error {
  readonly retryAfterMs: number;
  constructor(name: string, retryAfterMs: number) {
    super(`Circuit "${name}" is open; retry in ${Math.ceil(retryAfterMs / 1000)}s`);
    this.name = 'CircuitOpenError';
    this.retryAfterMs = retryAfterMs;
  }
}

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failures = 0;
  private successes = 0;
  private openedAt = 0;

  private readonly failureThreshold: number;
  private readonly cooldownMs: number;
  private readonly successThreshold: number;
  private readonly now: () => number;

  constructor(
    readonly name: string,
    options: CircuitBreakerOptions = {},
  ) {
    this.failureThreshold = options.failureThreshold ?? 5;
    this.cooldownMs = options.cooldownMs ?? 30_000;
    this.successThreshold = options.successThreshold ?? 1;
    this.now = options.now ?? (() => Date.now());
  }

  /** Current state, after applying any elapsed cooldown transition. */
  currentState(): CircuitState {
    this.maybeHalfOpen();
    return this.state;
  }

  /** Snapshot for health dashboards (§34). */
  snapshot(): { name: string; state: CircuitState; failures: number } {
    return { name: this.name, state: this.currentState(), failures: this.failures };
  }

  private maybeHalfOpen(): void {
    if (this.state === 'open' && this.now() - this.openedAt >= this.cooldownMs) {
      this.state = 'half_open';
      this.successes = 0;
    }
  }

  private onSuccess(): void {
    if (this.state === 'half_open') {
      this.successes += 1;
      if (this.successes >= this.successThreshold) {
        this.state = 'closed';
        this.failures = 0;
        this.successes = 0;
      }
    } else {
      this.failures = 0;
    }
  }

  private onFailure(): void {
    if (this.state === 'half_open') {
      // A failed probe re-opens immediately.
      this.trip();
      return;
    }
    this.failures += 1;
    if (this.failures >= this.failureThreshold) this.trip();
  }

  private trip(): void {
    this.state = 'open';
    this.openedAt = this.now();
    this.successes = 0;
  }

  /**
   * Run `fn` through the breaker. Fails fast with {@link CircuitOpenError} while
   * OPEN. Any thrown error counts as a failure and is re-thrown to the caller.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.maybeHalfOpen();
    if (this.state === 'open') {
      throw new CircuitOpenError(this.name, this.cooldownMs - (this.now() - this.openedAt));
    }
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }
}

/** Registry so a provider name maps to one shared breaker across calls. */
const registry = new Map<string, CircuitBreaker>();

export function getCircuitBreaker(
  name: string,
  options?: CircuitBreakerOptions,
): CircuitBreaker {
  let breaker = registry.get(name);
  if (!breaker) {
    breaker = new CircuitBreaker(name, options);
    registry.set(name, breaker);
  }
  return breaker;
}

/** Test helper — clear the shared registry. */
export function resetCircuitBreakers(): void {
  registry.clear();
}
