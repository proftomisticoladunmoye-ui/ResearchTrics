import { type NextRequest } from 'next/server';
import {
  runAssistantChat,
  getPlanStatus,
  incrementAssistantUsage,
  isAdmin,
  unauthorized,
  badRequest,
} from '@researchtrics/core';
import { ok, fail } from '@/lib/api';
import { getCurrentUser } from '@/lib/current-user';
import { enforceRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Conversational AI Assistant (§29, §48). Multi-turn research chat: the client
 * sends the whole message history each turn so the assistant remembers the
 * discussion. Same plan gating and never-fabricate contract as the writing
 * tools. Web browsing is premium-only.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.researcher) throw unauthorized('Sign in as a researcher to use the AI Assistant');
    await enforceRateLimit('assistant', `user:${user.researcher.id}`);

    const body = (await req.json().catch(() => ({}))) as {
      messages?: unknown;
      web?: boolean;
    };
    const rawMessages = Array.isArray(body.messages) ? body.messages : [];
    const messages: ChatMessage[] = rawMessages
      .filter(
        (m): m is ChatMessage =>
          !!m &&
          typeof m === 'object' &&
          (('role' in m && ((m as ChatMessage).role === 'user' || (m as ChatMessage).role === 'assistant'))) &&
          'content' in m &&
          typeof (m as ChatMessage).content === 'string',
      )
      .map((m) => ({ role: m.role, content: m.content }));
    if (messages.length === 0) throw badRequest('Send a message to the assistant');

    const { entitlements, aiRemaining } = await getPlanStatus(user.researcher.id, isAdmin(user.actor));
    if (aiRemaining <= 0) {
      throw badRequest(
        `You've used your ${entitlements.aiMonthlyLimit} AI generations for this month. Upgrade to Premium for more (and web browsing).`,
      );
    }
    const web = body.web === true && entitlements.webBrowsing;

    const result = await runAssistantChat(user.researcher.id, { messages, web });
    if (result.external && !result.offline) await incrementAssistantUsage(user.researcher.id);
    return ok(result);
  } catch (err) {
    return fail(err);
  }
}
