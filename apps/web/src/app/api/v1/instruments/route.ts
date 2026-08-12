import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { createInstrument, unauthorized, validationError } from '@researchtrics/core';
import { ok, fail } from '@/lib/api';
import { getCurrentUser } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

const schema = z.object({
  title: z.string().min(3).max(250),
  construct: z.string().max(500).optional(),
  population: z.string().max(500).optional(),
  language: z.string().max(120).optional(),
  country: z.string().max(120).optional(),
  itemCount: z.number().int().min(0).max(10000).optional(),
  responseScale: z.string().max(500).optional(),
  scoringMethod: z.string().max(1000).optional(),
  reliability: z.string().max(1000).optional(),
  validityEvidence: z.string().max(2000).optional(),
  factorStructure: z.string().max(1000).optional(),
  norms: z.string().max(1000).optional(),
  copyright: z.string().max(500).optional(),
  licenseCode: z.string().max(60).optional(),
  doi: z.string().max(200).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !user.researcher) throw unauthorized();
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw validationError('Invalid instrument', parsed.error.flatten());
    const result = await createInstrument(user.researcher.id, parsed.data);
    return ok({ slug: result.slug, publicId: result.publicId });
  } catch (err) {
    return fail(err);
  }
}
