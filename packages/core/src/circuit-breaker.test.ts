import { describe, it, expect } from 'vitest';
import {
  CircuitBreaker,
  CircuitOpenError,
  getCircuitBreaker,
  resetCircuitBreakers,
} from './circuit-breaker';

const fail = () => Promise.reject(new Error('upstream down'));
const succeed = () => Promise.resolve('ok');

describe('CircuitBreaker', () => {
  it('stays closed while calls succeed', async () => {
    const cb = new CircuitBreaker('t', { failureThreshold: 3 });
    expect(await cb.execute(succeed)).toBe('ok');
    expect(cb.currentState()).toBe('closed');
  });

  it('trips open after consecutive failures and then fails fast', async () => {
    const now = 0;
    const cb = new CircuitBreaker('t', { failureThreshold: 3, cooldownMs: 30_000, now: () => now });
    for (let i = 0; i < 3; i++) {
      await expect(cb.execute(fail)).rejects.toThrow('upstream down');
    }
    expect(cb.currentState()).toBe('open');
    // Fails fast without invoking fn.
    let invoked = false;
    await expect(
      cb.execute(async () => {
        invoked = true;
        return 'x';
      }),
    ).rejects.toBeInstanceOf(CircuitOpenError);
    expect(invoked).toBe(false);
  });

  it('half-opens after cooldown and closes on a successful probe', async () => {
    let now = 0;
    const cb = new CircuitBreaker('t', { failureThreshold: 2, cooldownMs: 10_000, now: () => now });
    await expect(cb.execute(fail)).rejects.toThrow();
    await expect(cb.execute(fail)).rejects.toThrow();
    expect(cb.currentState()).toBe('open');

    now = 10_001; // cooldown elapsed
    expect(cb.currentState()).toBe('half_open');
    expect(await cb.execute(succeed)).toBe('ok');
    expect(cb.currentState()).toBe('closed');
  });

  it('a failed probe re-opens the breaker', async () => {
    let now = 0;
    const cb = new CircuitBreaker('t', { failureThreshold: 1, cooldownMs: 5_000, now: () => now });
    await expect(cb.execute(fail)).rejects.toThrow();
    expect(cb.currentState()).toBe('open');
    now = 5_001;
    expect(cb.currentState()).toBe('half_open');
    await expect(cb.execute(fail)).rejects.toThrow();
    expect(cb.currentState()).toBe('open');
  });

  it('a success resets the failure count below threshold', async () => {
    const cb = new CircuitBreaker('t', { failureThreshold: 3 });
    await expect(cb.execute(fail)).rejects.toThrow();
    await expect(cb.execute(fail)).rejects.toThrow();
    await cb.execute(succeed); // resets
    await expect(cb.execute(fail)).rejects.toThrow();
    expect(cb.currentState()).toBe('closed');
  });

  it('registry returns one shared breaker per name', () => {
    resetCircuitBreakers();
    const a = getCircuitBreaker('crossref');
    const b = getCircuitBreaker('crossref');
    expect(a).toBe(b);
    expect(getCircuitBreaker('openalex')).not.toBe(a);
  });
});
