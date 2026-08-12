import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

/**
 * Envelope encryption for secrets at rest — e.g. OAuth access/refresh tokens
 * (Spec §13, §35). AES-256-GCM. Tokens are NEVER sent to the frontend.
 *
 * Serialized form: base64(iv).base64(authTag).base64(ciphertext)
 */

function loadKey(keyB64?: string): Buffer {
  const raw = keyB64 ?? process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) throw new Error('TOKEN_ENCRYPTION_KEY is not set');
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error('TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes (base64)');
  }
  return key;
}

export function encryptSecret(plaintext: string, keyB64?: string): string {
  const key = loadKey(keyB64);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('base64'), authTag.toString('base64'), ciphertext.toString('base64')].join(
    '.',
  );
}

export function decryptSecret(serialized: string, keyB64?: string): string {
  const key = loadKey(keyB64);
  const parts = serialized.split('.');
  if (parts.length !== 3) throw new Error('Malformed encrypted secret');
  const [ivB64, tagB64, dataB64] = parts as [string, string, string];
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]);
  return plaintext.toString('utf8');
}

/** Generate a high-entropy opaque session token (returned to the client once). */
export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Hash a session token for storage — we never store the raw token (Spec §35). */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Constant-time comparison of two hex-encoded hashes. */
export function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
