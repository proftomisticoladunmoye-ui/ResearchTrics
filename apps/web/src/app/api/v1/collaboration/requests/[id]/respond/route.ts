import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { respondToRequest, unauthorized, validationError } from '@researchtrics/core';
import { ok, fail } from '@/lib/api';
import { getCurrentUser } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

const schema = z.object({ accept: z.boolean() });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || !user.researcher) throw unauthorized();
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw validationError('Invalid response');
    const { id } = await params;
    await respondToRequest(id, user.researcher.id, parsed.data.accept);
    return ok({ status: parsed.data.accept ? 'accepted' : 'declined' });
  } catch (err) {
    return fail(err);
  }
}
