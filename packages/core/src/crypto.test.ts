import { describe, it, expect } from 'vitest';
import { randomBytes } from 'node:crypto';
import { encryptSecret, decryptSecret, hashToken, generateSessionToken } from './crypto';

const key = randomBytes(32).toString('base64');

describe('encryptSecret / decryptSecret', () => {
  it('round-trips a secret', () => {
    const plaintext = 'orcid-access-token-abc123';
    const enc = encryptSecret(plaintext, key);
    expect(enc).not.toContain(plaintext);
    expect(decryptSecret(enc, key)).toBe(plaintext);
  });

  it('produces distinct ciphertexts for the same input (random IV)', () => {
    expect(encryptSecret('x', key)).not.toBe(encryptSecret('x', key));
  });

  it('fails to decrypt with the wrong key', () => {
    const enc = encryptSecret('secret', key);
    const otherKey = randomBytes(32).toString('base64');
    expect(() => decryptSecret(enc, otherKey)).toThrow();
  });

  it('rejects a key that is not 32 bytes', () => {
    expect(() => encryptSecret('x', 'dG9vc2hvcnQ=')).toThrow();
  });
});

describe('session token', () => {
  it('hashes deterministically but is not the raw token', () => {
    const token = generateSessionToken();
    expect(hashToken(token)).toBe(hashToken(token));
    expect(hashToken(token)).not.toBe(token);
  });
});
