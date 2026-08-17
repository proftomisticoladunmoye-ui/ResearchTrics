import { type NextRequest } from 'next/server';
import { getPublicationBySlug, notifyEngagement, recordEvent, unauthorized, notFound } from '@researchtrics/core';
import { ok, fail } from '@/lib/api';
import { getCurrentUser } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

/**
 * Recommend a publication (§41). Records the interaction and notifies the work's
 * authors ("Someone recommended … from <country>"). Requires a signed-in user.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw unauthorized('Sign in to recommend');
    const { slug } = await params;
    const pub = await getPublicationBySlug(slug);
    if (!pub) throw notFound('Publication not found');

    const h = req.headers;
    const cc = (h.get('cf-ipcountry') ?? h.get('x-vercel-ip-country') ?? '').toUpperCase();
    let country: string | null = null;
    if (cc && cc !== 'XX' && cc.length === 2) {
      try {
        country = new Intl.DisplayNames(['en'], { type: 'region' }).of(cc) ?? cc;
      } catch {
        country = cc;
      }
    }

    await recordEvent({
      eventType: 'follow',
      entityType: 'publication',
      entityId: pub.id,
      userAgent: h.get('user-agent'),
    }).catch(() => {});
    await notifyEngagement({
      publicationId: pub.id,
      type: 'publication_recommend',
      country,
      excludeResearcherId: user.researcher?.id ?? null,
    });
    return ok({ recommended: true });
  } catch (err) {
    return fail(err);
  }
}
