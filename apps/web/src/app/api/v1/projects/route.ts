import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { createProject, unauthorized, validationError } from '@researchtrics/core';
import { ok, fail } from '@/lib/api';
import { getCurrentUser } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

const schema = z.object({
  title: z.string().min(3).max(250),
  description: z.string().max(5000).optional(),
  objectives: z.string().max(5000).optional(),
  researchQuestions: z.string().max(5000).optional(),
  methodology: z.string().max(5000).optional(),
  status: z.enum(['proposed', 'active', 'completed', 'suspended', 'archived']).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !user.researcher) throw unauthorized();
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw validationError('Invalid project', parsed.error.flatten());
    const result = await createProject(user.researcher.id, parsed.data, user.id);
    return ok({ slug: result.slug, publicId: result.publicId });
  } catch (err) {
    return fail(err);
  }
}
