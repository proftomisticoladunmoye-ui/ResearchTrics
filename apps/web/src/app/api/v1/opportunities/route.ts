import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { createOpportunity, unauthorized, validationError } from '@researchtrics/core';
import { ok, fail } from '@/lib/api';
import { getCurrentUser } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

const schema = z.object({
  title: z.string().min(3).max(300),
  type: z
    .enum([
      'grant',
      'fellowship',
      'call_for_papers',
      'conference',
      'position',
      'award',
      'training',
      'collaboration',
      'other',
    ])
    .optional(),
  summary: z.string().max(2000).optional(),
  organization: z.string().max(300).optional(),
  country: z.string().max(120).optional(),
  url: z.string().url().max(600).optional(),
  deadline: z.string().optional(),
  disciplines: z.string().max(600).optional(),
  sourceUrl: z.string().url().max(600).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) throw unauthorized();
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw validationError('Invalid opportunity', parsed.error.flatten());

    const d = parsed.data;
    const deadline = d.deadline ? new Date(d.deadline) : null;
    const opportunity = await createOpportunity(user.actor, {
      title: d.title,
      type: d.type,
      summary: d.summary ?? null,
      organization: d.organization ?? null,
      country: d.country ?? null,
      url: d.url ?? null,
      deadline: deadline && !Number.isNaN(deadline.getTime()) ? deadline : null,
      disciplines: d.disciplines
        ? d.disciplines.split(',').map((s) => s.trim()).filter(Boolean)
        : [],
      sourceUrl: d.sourceUrl ?? null,
    });
    return ok({ slug: opportunity.slug, publicId: opportunity.publicId });
  } catch (err) {
    return fail(err);
  }
}
