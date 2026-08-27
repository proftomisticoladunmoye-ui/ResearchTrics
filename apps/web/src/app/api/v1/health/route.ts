import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@researchtrics/db';
import { probeObjectStorage } from '@researchtrics/core';

export const dynamic = 'force-dynamic';

/**
 * Liveness + connectivity probe (Spec §72). Always checks the DB. Pass
 * `?storage=1` to also verify object storage with a real write→read→delete
 * round-trip — the operation a file upload performs — so an upload failure can
 * be diagnosed without server logs. The storage probe reveals no secrets.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  let database = 'unknown';
  try {
    await prisma.$queryRaw`SELECT 1`;
    database = 'up';
  } catch {
    database = 'down';
  }

  const checks: Record<string, unknown> = { database };
  if (req.nextUrl.searchParams.get('storage') === '1') {
    try {
      checks.storage = await probeObjectStorage();
    } catch (err) {
      checks.storage = { ok: false, detail: (err as Error).message.slice(0, 200) };
    }
  }

  const storageOk = !checks.storage || (checks.storage as { ok?: boolean }).ok !== false;
  const healthy = database === 'up' && storageOk;
  return NextResponse.json(
    {
      status: healthy ? 'ok' : 'degraded',
      service: 'researchtrics-web',
      checks,
      timestamp: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503 },
  );
}
