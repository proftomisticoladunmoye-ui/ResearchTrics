import { describe, it, expect } from 'vitest';
import {
  RateLimiter,
  MemoryRateLimitStore,
  checkRateLimit,
  RATE_LIMITS,
} from './rate-limit';

describe('RateLimiter', () => {
  it('permits hits up to the limit, then blocks', async () => {
    const now = 1_000;
    const limiter = new RateLimiter({ now: () => now });
    const rule = { limit: 3, windowMs: 60_000 };

    const d1 = await limiter.hit('k', rule);
    const d2 = await limiter.hit('k', rule);
    const d3 = await limiter.hit('k', rule);
    const d4 = await limiter.hit('k', rule);

    expect([d1.allowed, d2.allowed, d3.allowed]).toEqual([true, true, true]);
    expect(d3.remaining).toBe(0);
    expect(d4.allowed).toBe(false);
    expect(d4.remaining).toBe(0);
    expect(d4.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('does not keep incrementing once blocked (retryAfter reflects real reset)', async () => {
    let now = 0;
    const limiter = new RateLimiter({ now: () => now });
    const rule = { limit: 1, windowMs: 10_000 };
    await limiter.hit('k', rule); // consumes the only slot; resetAt = 10_000
    now = 6_000;
    const blocked = await limiter.hit('k', rule);
    expect(blocked.allowed).toBe(false);
    // 4s remain in the window → ceil = 4
    expect(blocked.retryAfterSeconds).toBe(4);
  });

  it('resets after the window elapses', async () => {
    let now = 0;
    const limiter = new RateLimiter({ now: () => now });
    const rule = { limit: 2, windowMs: 1_000 };
    await limiter.hit('k', rule);
    await limiter.hit('k', rule);
    expect((await limiter.hit('k', rule)).allowed).toBe(false);
    now = 1_001;
    const afterReset = await limiter.hit('k', rule);
    expect(afterReset.allowed).toBe(true);
    expect(afterReset.remaining).toBe(1);
  });

  it('isolates distinct keys', async () => {
    const limiter = new RateLimiter();
    const rule = { limit: 1, windowMs: 60_000 };
    expect((await limiter.hit('a', rule)).allowed).toBe(true);
    expect((await limiter.hit('b', rule)).allowed).toBe(true);
    expect((await limiter.hit('a', rule)).allowed).toBe(false);
  });

  it('MemoryRateLimitStore.prune drops elapsed windows on demand', () => {
    const store = new MemoryRateLimitStore();
    store.set('old', { count: 5, resetAt: 1_000 });
    store.set('new', { count: 1, resetAt: 5_000 });
    store.prune(2_000);
    expect(store.get('old')).toBeUndefined();
    expect(store.get('new')).toEqual({ count: 1, resetAt: 5_000 });
  });

  it('checkRateLimit namespaces by rule + caller key', async () => {
    const limiter = new RateLimiter();
    // Exhaust login for one IP; a different IP is unaffected.
    for (let i = 0; i < RATE_LIMITS.login.limit; i++) {
      await checkRateLimit('login', 'ip:1.1.1.1', limiter);
    }
    expect((await checkRateLimit('login', 'ip:1.1.1.1', limiter)).allowed).toBe(false);
    expect((await checkRateLimit('login', 'ip:2.2.2.2', limiter)).allowed).toBe(true);
    // Same key, different rule namespace is independent.
    expect((await checkRateLimit('register', 'ip:1.1.1.1', limiter)).allowed).toBe(true);
  });
});
