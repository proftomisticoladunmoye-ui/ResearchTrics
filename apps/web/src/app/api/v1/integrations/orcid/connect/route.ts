import { NextResponse, type NextRequest } from 'next/server';
import { randomBytes } from 'node:crypto';
import { buildAuthUrl, loadOrcidConfig, isOrcidConfigured } from '@researchtrics/integration-orcid';
import { getCurrentUser } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

const ORCID_STATE_COOKIE = 'rt_orcid_state';
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

/** Begin ORCID OAuth: set a CSRF state cookie and redirect to ORCID (Spec §13, §35). */
export async function GET(_req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.researcher) {
    return NextResponse.redirect(`${appUrl}/login`);
  }
  if (!isOrcidConfigured()) {
    return NextResponse.redirect(`${appUrl}/dashboard/profile?orcid=unconfigured`);
  }

  const state = randomBytes(16).toString('base64url');
  const config = loadOrcidConfig();
  const res = NextResponse.redirect(buildAuthUrl(config, state));
  res.cookies.set(ORCID_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 600,
  });
  return res;
}
