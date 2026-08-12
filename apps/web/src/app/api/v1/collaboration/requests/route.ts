import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { createCollaborationRequest, unauthorized, validationError } from '@researchtrics/core';
import { ok, fail } from '@/lib/api';
import { getCurrentUser } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

const schema = z.object({ toResearcherId: z.string().uuid(), message: z.string().max(1000).optional() });

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !user.researcher) throw unauthorized();
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw validationError('Invalid request');
    const result = await createCollaborationRequest(
      user.researcher.id,
      parsed.data.toResearcherId,
      parsed.data.message ?? null,
    );
    return ok({ id: result.id });
  } catch (err) {
    return fail(err);
  }
}
