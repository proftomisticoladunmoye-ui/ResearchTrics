import { NextResponse } from 'next/server';
import { prisma } from '@researchtrics/db';

export const dynamic = 'force-dynamic';

/** Liveness + DB connectivity probe (Spec §72). */
export async function GET(): Promise<NextResponse> {
  let database = 'unknown';
  try {
    await prisma.$queryRaw`SELECT 1`;
    database = 'up';
  } catch {
    database = 'down';
  }
  const healthy = database === 'up';
  return NextResponse.json(
    {
      status: healthy ? 'ok' : 'degraded',
      service: 'researchtrics-web',
      checks: { database },
      timestamp: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503 },
  );
}
