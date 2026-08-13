import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { claimProfile, startClaim, unauthorized, validationError } from '@researchtrics/core';
import { ok, fail } from '@/lib/api';
import { getCurrentUser } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

// Only the institutional-email path is client-callable. The ORCID path is
// completed server-side by the ORCID OAuth callback so a typed ORCID can never
// claim a profile (Discovery Engine §12).
const schema = z.object({ method: z.literal('institution') });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw unauthorized('Sign in to claim a profile');
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw validationError('Unsupported claim method');
    const { id } = await params;

    await startClaim(id, user.id);
    const result = await claimProfile(id, user.id, {
      method: 'institution',
      verifiedEmail: user.email,
    });
    return ok(result);
  } catch (err) {
    return fail(err);
  }
}
