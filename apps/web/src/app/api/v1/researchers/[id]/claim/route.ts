import { type NextRequest } from 'next/server';
import { z } from 'zod';
import {
  claimProfile,
  startClaim,
  assessClaimRisk,
  recordSecurityEvent,
  unauthorized,
  validationError,
} from '@researchtrics/core';
import { ok, fail } from '@/lib/api';
import { enforceRateLimit, clientIp } from '@/lib/rate-limit';
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

    // Throttle claim attempts per user (Discovery §32, Phase 15).
    await enforceRateLimit('claim', `user:${user.id}`);

    // Anti-fraud risk assessment (Discovery §33). Advisory: a high/elevated
    // score routes the claim to manual review instead of auto-completing. It
    // never accuses — the profile is simply not auto-associated.
    const risk = await assessClaimRisk({
      userId: user.id,
      researcherId: id,
      email: user.email,
    });

    if (risk.requiresReview) {
      await recordSecurityEvent({
        action: 'claim.held_for_review',
        actorId: user.id,
        entityType: 'researcher',
        entityId: id,
        detail: { level: risk.level, score: risk.score, signals: risk.signals },
        ip: clientIp(req),
      });
      await startClaim(id, user.id);
      return ok({
        status: 'held_for_review',
        reason:
          'Your claim needs a quick manual review before it is applied. No action is required from you right now.',
        riskLevel: risk.level,
      });
    }

    await startClaim(id, user.id);
    const result = await claimProfile(id, user.id, {
      method: 'institution',
      verifiedEmail: user.email,
    });
    return ok({ status: 'claimed', ...result });
  } catch (err) {
    return fail(err);
  }
}
