import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { createManualPublication, unauthorized, validationError } from '@researchtrics/core';
import { ok, fail } from '@/lib/api';
import { getCurrentUser } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

const OUTPUT_TYPES = [
  'journal_article',
  'conference_paper',
  'book',
  'book_chapter',
  'thesis',
  'dissertation',
  'preprint',
  'technical_report',
  'research_report',
  'poster',
  'presentation',
  'policy_brief',
  'systematic_review',
  'other',
] as const;

const schema = z.object({
  title: z.string().min(3).max(500),
  outputType: z.enum(OUTPUT_TYPES).optional(),
  abstract: z.string().max(10000).optional(),
  publishedYear: z.number().int().min(1500).max(2100).optional(),
  venue: z.string().max(300).optional(),
  publisher: z.string().max(300).optional(),
  primaryFileId: z.string().uuid().optional(),
  coAuthors: z
    .array(z.object({ name: z.string().min(1).max(200), orcid: z.string().max(40).optional() }))
    .max(30)
    .optional(),
});

/** Add a publication by hand (non-DOI outputs — books, talks, reports). */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !user.researcher) throw unauthorized('Sign in with a researcher profile');

    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw validationError('Invalid publication', parsed.error.flatten());

    const result = await createManualPublication(user.researcher.id, user.researcher.displayName, {
      title: parsed.data.title,
      outputType: parsed.data.outputType,
      abstract: parsed.data.abstract ?? null,
      publishedYear: parsed.data.publishedYear ?? null,
      venue: parsed.data.venue ?? null,
      publisher: parsed.data.publisher ?? null,
      primaryFileId: parsed.data.primaryFileId ?? null,
      coAuthors: parsed.data.coAuthors?.map((c) => ({ name: c.name, orcid: c.orcid ?? null })) ?? [],
    });
    return ok(result);
  } catch (err) {
    return fail(err);
  }
}
