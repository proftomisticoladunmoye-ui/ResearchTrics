import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { addResearcherAffiliation, unauthorized, validationError } from '@researchtrics/core';
import { ok, fail } from '@/lib/api';
import { getCurrentUser } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

const schema = z.object({
  institution: z.string().min(2).max(200),
  country: z.string().max(80).optional(),
  role: z
    .enum(['faculty', 'postdoc', 'phd_student', 'masters_student', 'research_staff', 'visiting', 'emeritus', 'other'])
    .optional(),
  isPrimary: z.boolean().optional(),
});

/** Add an affiliation for the current researcher by institution name (§7). */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !user.researcher) throw unauthorized('Sign in with a researcher profile');
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw validationError('Invalid affiliation', parsed.error.flatten());

    const aff = await addResearcherAffiliation({
      researcherId: user.researcher.id,
      institutionName: parsed.data.institution,
      country: parsed.data.country ?? null,
      role: parsed.data.role,
      isPrimary: parsed.data.isPrimary ?? false,
    });
    return ok({ id: aff.id });
  } catch (err) {
    return fail(err);
  }
}
