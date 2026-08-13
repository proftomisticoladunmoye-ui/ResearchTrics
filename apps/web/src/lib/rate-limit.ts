import { type NextRequest } from 'next/server';
import { checkRateLimit, AppError, type RateLimitName } from '@researchtrics/core';

/**
 * Derive a best-effort client IP for rate-limit keying. Behind a trusted proxy
 * `x-forwarded-for` is the left-most hop; falls back to `x-real-ip`. Never used
 * for anything but coarse throttling — not for identity or authorization.
 */
export function clientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]!.trim();
  return req.headers.get('x-real-ip')?.trim() || 'unknown';
}

/**
 * Enforce a named rate limit for a caller key. Throws a RATE_LIMITED AppError
 * (429) carrying a Retry-After hint in `details` when exceeded. The `fail`
 * helper renders it as a consistent problem response.
 */
export async function enforceRateLimit(name: RateLimitName, callerKey: string): Promise<void> {
  const decision = await checkRateLimit(name, callerKey);
  if (!decision.allowed) {
    throw new AppError('RATE_LIMITED', 'Too many requests. Please slow down and try again shortly.', {
      details: { retryAfterSeconds: decision.retryAfterSeconds },
    });
  }
}
