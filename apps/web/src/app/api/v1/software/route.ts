import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { createSoftware, unauthorized, validationError } from '@researchtrics/core';
import { ok, fail } from '@/lib/api';
import { getCurrentUser } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

const schema = z.object({
  name: z.string().min(2).max(200),
  description: z.string().max(5000).optional(),
  version: z.string().max(60).optional(),
  repositoryUrl: z.string().url().max(500).optional().or(z.literal('')),
  doi: z.string().max(200).optional(),
  licenseCode: z.string().max(60).optional(),
  documentationUrl: z.string().url().max(500).optional().or(z.literal('')),
  citationText: z.string().max(1000).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !user.researcher) throw unauthorized();
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw validationError('Invalid software', parsed.error.flatten());
    const { repositoryUrl, documentationUrl, ...rest } = parsed.data;
    const result = await createSoftware(user.researcher.id, {
      ...rest,
      repositoryUrl: repositoryUrl || null,
      documentationUrl: documentationUrl || null,
    });
    return ok({ slug: result.slug, publicId: result.publicId });
  } catch (err) {
    return fail(err);
  }
}
