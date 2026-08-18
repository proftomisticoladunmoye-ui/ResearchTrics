import { cache } from 'react';
import { cookies } from 'next/headers';
import { validateSession, type Actor } from '@researchtrics/core';
import { prisma } from '@researchtrics/db';
import { SESSION_COOKIE } from './session-cookie';

export interface CurrentUser {
  id: string;
  email: string;
  actor: Actor;
  researcher: {
    id: string;
    displayName: string;
    researchtricsId: string;
    slug: string;
    photoUrl: string | null;
  } | null;
}

/**
 * Resolve the authenticated user for server components / route handlers.
 * Returns null when unauthenticated. Never throws on missing session.
 *
 * Memoized per request with React `cache()` so multiple callers in one render
 * (root layout, header, mobile tab bar, the page itself) share a single session
 * validation + lookup instead of re-querying the database each time.
 */
export const getCurrentUser = cache(async function getCurrentUser(): Promise<CurrentUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const validated = await validateSession(token);
  if (!validated) return null;

  const [roles, researcher] = await Promise.all([
    prisma.userRole.findMany({ where: { userId: validated.user.id } }),
    prisma.researcher.findUnique({ where: { userId: validated.user.id } }),
  ]);

  return {
    id: validated.user.id,
    email: validated.user.email,
    actor: {
      userId: validated.user.id,
      roles: roles.map((r) => ({
        role: r.role,
        scopeType: r.scopeType,
        scopeId: r.scopeId,
      })),
    },
    researcher: researcher
      ? {
          id: researcher.id,
          displayName: researcher.displayName,
          researchtricsId: researcher.researchtricsId,
          slug: researcher.slug,
          photoUrl: researcher.photoUrl,
        }
      : null,
  };
});
