import { type NextRequest } from 'next/server';
import {
  runAssistantTask,
  ASSISTANT_TASKS,
  getPlanStatus,
  incrementAssistantUsage,
  isAdmin,
  unauthorized,
  badRequest,
  type AssistantTask,
} from '@researchtrics/core';
import { ok, fail } from '@/lib/api';
import { getCurrentUser } from '@/lib/current-user';
import { enforceRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * AI Assistant (§29, §48). Runs one grounded writing task over the author's own
 * supplied material. Requires a signed-in researcher (it works on their behalf,
 * over their own text). Never fabricates — see core/ai-assistant.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.researcher) throw unauthorized('Sign in as a researcher to use the AI Assistant');
    await enforceRateLimit('assistant', `user:${user.researcher.id}`);

    const body = (await req.json().catch(() => ({}))) as {
      task?: string;
      material?: string;
      directive?: string;
      web?: boolean;
      length?: string;
    };
    const task = body.task as AssistantTask | undefined;
    if (!task || !ASSISTANT_TASKS.includes(task)) throw badRequest('Choose a valid assistant task');
    const length = ['brief', 'standard', 'detailed'].includes(String(body.length))
      ? (body.length as 'brief' | 'standard' | 'detailed')
      : undefined;

    // Plan gating (§premium): free plans get a monthly AI allowance; web
    // browsing is premium-only. Admins are treated as premium.
    const { entitlements, aiRemaining } = await getPlanStatus(user.researcher.id, isAdmin(user.actor));
    if (aiRemaining <= 0) {
      throw badRequest(
        `You've used your ${entitlements.aiMonthlyLimit} AI generations for this month. Upgrade to Premium for more (and web browsing).`,
      );
    }
    const web = body.web === true && entitlements.webBrowsing;

    const result = await runAssistantTask(user.researcher.id, {
      task,
      material: String(body.material ?? ''),
      directive: body.directive ? String(body.directive) : undefined,
      web,
      length,
    });
    // Only meter real (external) generations against the allowance.
    if (result.external && !result.offline) await incrementAssistantUsage(user.researcher.id);
    return ok(result);
  } catch (err) {
    return fail(err);
  }
}
