import { type NextRequest } from 'next/server';
import { z } from 'zod';
import {
  saveOpportunity,
  unsaveOpportunity,
  unauthorized,
  validationError,
} from '@researchtrics/core';
import { ok, fail } from '@/lib/api';
import { getCurrentUser } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

const schema = z.object({ saved: z.boolean() });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || !user.researcher) throw unauthorized('Sign in as a researcher to save opportunities');
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw validationError('Expected { saved: boolean }');
    const { id } = await params;

    if (parsed.data.saved) {
      await saveOpportunity(user.researcher.id, id);
    } else {
      await unsaveOpportunity(user.researcher.id, id);
    }
    return ok({ opportunityId: id, saved: parsed.data.saved });
  } catch (err) {
    return fail(err);
  }
}
