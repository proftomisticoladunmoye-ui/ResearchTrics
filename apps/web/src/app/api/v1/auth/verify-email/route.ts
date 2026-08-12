import { NextResponse, type NextRequest } from 'next/server';
import { verifyEmailToken } from '@researchtrics/core';

export const dynamic = 'force-dynamic';

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

/** Consume an email-verification link, then redirect to a status page. */
export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get('token');
  if (!token) return NextResponse.redirect(`${appUrl}/verify-email?status=invalid`);
  try {
    await verifyEmailToken(token);
    return NextResponse.redirect(`${appUrl}/verify-email?status=ok`);
  } catch {
    return NextResponse.redirect(`${appUrl}/verify-email?status=invalid`);
  }
}
