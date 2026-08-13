import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { setPublicationClaim, unauthorized, forbidden, validationError } from '@researchtrics/core';
import { prisma } from '@researchtrics/db';
import { ok, fail } from '@/lib/api';
import { getCurrentUser } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

const schema = z.object({
  decision: z.enum(['claimed', 'disputed', 'review']),
  reason: z.string().max(500).optional(),
});

/**
 * Claim or dispute a candidate publication (Discovery Engine §14, §15). Only the
 * profile owner may decide; a dispute removes only their association, never the
 * global scholarly record.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; pubId: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) throw unauthorized();
    const { id, pubId } = await params;

    const researcher = await prisma.researcher.findUnique({
      where: { id },
      select: { userId: true },
    });
    if (!researcher || researcher.userId !== user.id) {
      throw forbidden('Only the profile owner can decide publication claims');
    }

    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw validationError('Invalid decision');

    await setPublicationClaim(id, pubId, parsed.data.decision, parsed.data.reason);
    return ok({ publicationId: pubId, decision: parsed.data.decision });
  } catch (err) {
    return fail(err);
  }
}
