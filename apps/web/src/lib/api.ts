import { NextResponse } from 'next/server';
import { toProblem, logger } from '@researchtrics/core';

/** Consistent JSON success envelope. */
export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ data }, { status: 200, ...init });
}

/** Consistent JSON error envelope (never leaks internals — Spec §35). */
export function fail(err: unknown): NextResponse {
  const problem = toProblem(err);
  if (problem.status >= 500) {
    logger.error({ err }, 'Unhandled API error');
  }
  const res = NextResponse.json(problem.body, { status: problem.status });
  // Surface a Retry-After hint for throttled callers (Phase 15).
  if (problem.status === 429) {
    const details = problem.body.error.details as { retryAfterSeconds?: number } | undefined;
    const retry = details?.retryAfterSeconds;
    if (typeof retry === 'number') res.headers.set('Retry-After', String(retry));
  }
  return res;
}
