import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';

/**
 * Claim-token helpers (Discovery Engine §32).
 *
 * The raw token is shown once to the invitee and NEVER stored — only its
 * SHA-256 hash is persisted. Tokens are cryptographically random, expiring, and
 * verified in constant time to resist enumeration.
 */

export interface ClaimToken {
  /** The raw token — delivered to the invitee, never stored. */
  token: string;
  /** SHA-256 hash — this is what gets persisted. */
  tokenHash: string;
  expiresAt: Date;
}

/** SHA-256 hex hash of a raw token. */
export function hashClaimToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** Generate a fresh claim token with a hashed form and expiry (default 14 days). */
export function generateClaimToken(ttlMs = 14 * 24 * 60 * 60 * 1000): ClaimToken {
  const token = randomBytes(32).toString('base64url');
  return {
    token,
    tokenHash: hashClaimToken(token),
    expiresAt: new Date(Date.now() + ttlMs),
  };
}

/** Constant-time verification of a raw token against a stored hash. */
export function verifyClaimToken(token: string, storedHash: string): boolean {
  const candidate = Buffer.from(hashClaimToken(token), 'hex');
  const expected = Buffer.from(storedHash, 'hex');
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

export function isTokenExpired(expiresAt: Date, now: Date = new Date()): boolean {
  return expiresAt.getTime() <= now.getTime();
}
