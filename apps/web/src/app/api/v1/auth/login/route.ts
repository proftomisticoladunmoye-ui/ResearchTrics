import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { authenticate, createSession, validationError } from '@researchtrics/core';
import { ok, fail } from '@/lib/api';
import { SESSION_COOKIE, sessionCookieOptions } from '@/lib/session-cookie';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const json = await req.json().catch(() => {
      throw validationError('Invalid JSON body');
    });
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) throw validationError('Email and password are required');

    const user = await authenticate(parsed.data.email, parsed.data.password);

    const session = await createSession(user.id, {
      ip: req.headers.get('x-forwarded-for') ?? undefined,
      userAgent: req.headers.get('user-agent') ?? undefined,
    });

    const res = ok({ authenticated: true });
    res.cookies.set(SESSION_COOKIE, session.token, sessionCookieOptions(session.expiresAt));
    return res;
  } catch (err) {
    return fail(err);
  }
}
