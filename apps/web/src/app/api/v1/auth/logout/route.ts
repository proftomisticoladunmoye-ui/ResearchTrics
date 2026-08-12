import { type NextRequest } from 'next/server';
import { revokeSession } from '@researchtrics/core';
import { ok, fail } from '@/lib/api';
import { SESSION_COOKIE, clearedSessionCookieOptions } from '@/lib/session-cookie';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(SESSION_COOKIE)?.value;
    if (token) await revokeSession(token);
    const res = ok({ authenticated: false });
    res.cookies.set(SESSION_COOKIE, '', clearedSessionCookieOptions());
    return res;
  } catch (err) {
    return fail(err);
  }
}
