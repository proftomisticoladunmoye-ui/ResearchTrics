import { NextResponse, type NextRequest } from 'next/server';
import { connectOrcid } from '@researchtrics/integration-orcid';
import { logger } from '@researchtrics/core';
import { getCurrentUser } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

const ORCID_STATE_COOKIE = 'rt_orcid_state';
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

function back(status: string): NextResponse {
  const res = NextResponse.redirect(`${appUrl}/dashboard/profile?orcid=${status}`);
  res.cookies.set(ORCID_STATE_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}

/** ORCID OAuth callback: verify CSRF state, exchange code, connect the iD. */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.researcher) return NextResponse.redirect(`${appUrl}/login`);

  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const cookieState = req.cookies.get(ORCID_STATE_COOKIE)?.value;

  if (url.searchParams.get('error')) return back('denied');
  if (!code || !state || !cookieState || state !== cookieState) return back('invalid_state');

  try {
    await connectOrcid(user.researcher.id, code);
    return back('connected');
  } catch (err) {
    logger.warn({ err }, 'ORCID connect failed');
    return back('error');
  }
}
