import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { createDataset, unauthorized, validationError } from '@researchtrics/core';
import { ok, fail } from '@/lib/api';
import { getCurrentUser } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

const schema = z.object({
  title: z.string().min(3).max(250),
  description: z.string().max(5000).optional(),
  sample: z.string().max(1000).optional(),
  geography: z.string().max(500).optional(),
  methodology: z.string().max(2000).optional(),
  fileFormats: z.string().max(500).optional(),
  accessLevel: z.enum(['open', 'restricted', 'request', 'embargoed', 'private']).optional(),
  licenseCode: z.string().max(60).optional(),
  doi: z.string().max(200).optional(),
  ethicsInfo: z.string().max(2000).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !user.researcher) throw unauthorized();
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw validationError('Invalid dataset', parsed.error.flatten());
    const result = await createDataset(user.researcher.id, parsed.data);
    return ok({ slug: result.slug, publicId: result.publicId });
  } catch (err) {
    return fail(err);
  }
}
