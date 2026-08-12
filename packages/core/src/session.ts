import { prisma, type Session, type User } from '@researchtrics/db';
import { generateSessionToken, hashToken } from './crypto';

/**
 * Server-side session management (Spec §35). The raw token is returned to the
 * caller exactly once (to set as an HttpOnly cookie); only its hash is stored.
 */

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

export interface SessionContext {
  ip?: string | undefined;
  userAgent?: string | undefined;
}

export interface CreatedSession {
  token: string;
  expiresAt: Date;
}

export async function createSession(userId: string, ctx: SessionContext = {}): Promise<CreatedSession> {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt,
      ip: ctx.ip ?? null,
      userAgent: ctx.userAgent ?? null,
    },
  });
  return { token, expiresAt };
}

export interface ValidatedSession {
  session: Session;
  user: User;
}

export async function validateSession(token: string): Promise<ValidatedSession | null> {
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  if (session.user.deletedAt || session.user.status === 'suspended') return null;
  const { user, ...rest } = session;
  return { session: rest as Session, user };
}

/** Rotate a session token (e.g. after privilege change) — invalidates the old one. */
export async function rotateSession(
  oldToken: string,
  ctx: SessionContext = {},
): Promise<CreatedSession | null> {
  const existing = await prisma.session.findUnique({ where: { tokenHash: hashToken(oldToken) } });
  if (!existing) return null;
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.$transaction([
    prisma.session.create({
      data: {
        userId: existing.userId,
        tokenHash: hashToken(token),
        expiresAt,
        rotatedFrom: existing.id,
        ip: ctx.ip ?? null,
        userAgent: ctx.userAgent ?? null,
      },
    }),
    prisma.session.delete({ where: { id: existing.id } }),
  ]);
  return { token, expiresAt };
}

export async function revokeSession(token: string): Promise<void> {
  await prisma.session
    .delete({ where: { tokenHash: hashToken(token) } })
    .catch(() => undefined);
}
