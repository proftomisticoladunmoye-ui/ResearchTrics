import { headers } from 'next/headers';
import { recordEvent, type AnalyticsEventType } from '@researchtrics/core';

/**
 * Record a view/interaction for the current request (Spec §41). Reads UA / IP /
 * referrer from request headers, filters bots, and never blocks or throws — a
 * failed analytics write must never break a page render.
 */
export async function track(
  eventType: AnalyticsEventType,
  entityType: string,
  entityId: string,
): Promise<void> {
  try {
    const h = await headers();
    await recordEvent({
      eventType,
      entityType,
      entityId,
      userAgent: h.get('user-agent'),
      ip: h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip'),
      referrer: h.get('referer'),
    });
  } catch {
    // analytics is best-effort
  }
}
