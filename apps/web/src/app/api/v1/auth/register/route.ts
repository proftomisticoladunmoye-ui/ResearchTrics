import { type NextRequest } from 'next/server';
import { z } from 'zod';
import {
  registerResearcher,
  createSession,
  issueEmailVerification,
  validationError,
  logger,
} from '@researchtrics/core';
import { ok, fail } from '@/lib/api';
import { enforceRateLimit, clientIp } from '@/lib/rate-limit';
import { SESSION_COOKIE, sessionCookieOptions } from '@/lib/session-cookie';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(10),
  displayName: z.string().min(2).max(120),
});

export async function POST(req: NextRequest) {
  try {
    const json = await req.json().catch(() => {
      throw validationError('Invalid JSON body');
    });
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      throw validationError('Invalid registration details', parsed.error.flatten());
    }

    // Throttle account creation per IP (Spec §35, Phase 15).
    await enforceRateLimit('register', `ip:${clientIp(req)}`);

    const { user, researcher } = await registerResearcher(parsed.data);

    // Dispatch email verification (best-effort; never blocks registration).
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    await issueEmailVerification(user.id, user.email, appUrl).catch((err) => {
      logger.warn({ err }, 'Failed to dispatch verification email');
    });

    const session = await createSession(user.id, {
      ip: req.headers.get('x-forwarded-for') ?? undefined,
      userAgent: req.headers.get('user-agent') ?? undefined,
    });

    const res = ok({
      researchtricsId: researcher.researchtricsId,
      slug: researcher.slug,
      displayName: researcher.displayName,
    });
    res.cookies.set(SESSION_COOKIE, session.token, sessionCookieOptions(session.expiresAt));
    return res;
  } catch (err) {
    return fail(err);
  }
}
