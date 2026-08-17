import { headers } from 'next/headers';
import { isBotUserAgent, notifyEngagement } from '@researchtrics/core';
import { type NotificationType } from '@researchtrics/db';

/** ISO country → display name (best-effort; falls back to the code). */
function countryName(code: string | null | undefined): string | null {
  if (!code || code === 'XX' || code.length !== 2) return null;
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

/**
 * Fire an engagement notification for the current request — bot-filtered, and
 * with a coarse country from the edge (`cf-ipcountry` when the site is proxied
 * through Cloudflare). Best-effort: never throws, never blocks the response.
 */
export async function notifyEngagementFromRequest(
  publicationId: string,
  type: NotificationType,
  excludeResearcherId?: string | null,
): Promise<void> {
  try {
    const h = await headers();
    if (isBotUserAgent(h.get('user-agent'))) return;
    const country = countryName(h.get('cf-ipcountry') ?? h.get('x-vercel-ip-country'));
    await notifyEngagement({ publicationId, type, country, excludeResearcherId: excludeResearcherId ?? null });
  } catch {
    /* best-effort */
  }
}
