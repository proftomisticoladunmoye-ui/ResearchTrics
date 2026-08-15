import { NextResponse, type NextRequest } from 'next/server';

/**
 * Security headers (Phase 15 hardening, Spec §35).
 *
 * Applied to every response. Conservative, framework-compatible defaults:
 *  - HSTS in production only (never force TLS on localhost dev).
 *  - A restrictive-but-workable CSP. `'unsafe-inline'` for styles is required by
 *    Tailwind's runtime style injection; scripts additionally allow
 *    `'unsafe-inline'` because Next.js App Router inlines bootstrap scripts
 *    without a per-request nonce here. Tightening to nonces is a follow-up.
 *  - Clickjacking, MIME-sniffing, referrer, and cross-origin isolation guards.
 */

const isProd = process.env.NODE_ENV === 'production';

const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline'" + (isProd ? '' : " 'unsafe-eval'"),
  "connect-src 'self'",
  "manifest-src 'self'",
  ...(isProd ? ['upgrade-insecure-requests'] : []),
].join('; ');

export function middleware(_req: NextRequest): NextResponse {
  const res = NextResponse.next();
  const h = res.headers;

  h.set('Content-Security-Policy', CSP);
  h.set('X-Content-Type-Options', 'nosniff');
  h.set('X-Frame-Options', 'DENY');
  h.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  h.set('X-DNS-Prefetch-Control', 'off');
  h.set('Cross-Origin-Opener-Policy', 'same-origin');
  h.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), browsing-topics=(), interest-cohort=()',
  );
  if (isProd) {
    h.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  }
  return res;
}

export const config = {
  // Apply to all routes except Next internals, common static assets, and the
  // Google Search Console verification file (served pristine from /public).
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.*|google[0-9a-f]+\\.html).*)'],
};
