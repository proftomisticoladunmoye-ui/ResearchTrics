import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { validationError, unauthorized, badRequest, isValidDoi } from '@researchtrics/core';
import { NotFoundError } from '@researchtrics/integration-shared';
import { ok, fail } from '@/lib/api';
import { getCurrentUser } from '@/lib/current-user';
import { importPublicationByDoi } from '@/lib/import-publication';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({ doi: z.string().min(3) });

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !user.researcher) throw unauthorized();

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw validationError('A DOI is required');
    if (!isValidDoi(parsed.data.doi)) throw badRequest('That does not look like a valid DOI');

    try {
      const result = await importPublicationByDoi(parsed.data.doi);
      return ok(result);
    } catch (err) {
      if (err instanceof NotFoundError) {
        throw badRequest('No metadata was found for that DOI at Crossref');
      }
      throw err;
    }
  } catch (err) {
    return fail(err);
  }
}
