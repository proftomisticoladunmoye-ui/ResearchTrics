import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { createGroup, unauthorized, validationError } from '@researchtrics/core';
import { ok, fail } from '@/lib/api';
import { getCurrentUser } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

const schema = z.object({
  name: z.string().min(3).max(160),
  description: z.string().max(3000).optional(),
  interests: z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !user.researcher) throw unauthorized();
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw validationError('Invalid group', parsed.error.flatten());
    const result = await createGroup(user.researcher.id, parsed.data);
    return ok({ slug: result.slug });
  } catch (err) {
    return fail(err);
  }
}
