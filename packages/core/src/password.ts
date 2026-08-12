import { hash, verify } from '@node-rs/argon2';

/**
 * Password hashing with Argon2id (Spec §35). @node-rs/argon2 defaults to the
 * argon2id variant; parameters follow OWASP guidance for interactive logins.
 */
const OPTIONS = {
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
} as const;

/** Basic strength gate; the real policy lives at the validation boundary. */
export function assertPasswordPolicy(password: string): void {
  if (password.length < 10) {
    throw new Error('Password must be at least 10 characters');
  }
}

export async function hashPassword(password: string): Promise<string> {
  assertPasswordPolicy(password);
  return hash(password, OPTIONS);
}

export async function verifyPassword(digest: string, password: string): Promise<boolean> {
  try {
    return await verify(digest, password);
  } catch {
    return false;
  }
}
