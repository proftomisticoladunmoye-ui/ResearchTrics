import { type NextRequest } from 'next/server';
import {
  getBulletinById,
  mintBulletinDoi,
  bulletinDoiProvider,
  renderBulletinPdf,
  isAdmin,
  unauthorized,
  badRequest,
} from '@researchtrics/core';
import { ok, fail } from '@/lib/api';
import { getCurrentUser } from '@/lib/current-user';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.researchtrics.com';

/**
 * Admin: mint a DOI for a published bulletin (§20). Uses Zenodo (free) when
 * configured — depositing the generated PDF — else DataCite. Idempotent.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || !isAdmin(user.actor)) throw unauthorized();
    const { id } = await params;

    const provider = bulletinDoiProvider();
    if (!provider) throw badRequest('DOI minting is not configured (set ZENODO_TOKEN, or the DATACITE_* variables).');

    // Zenodo requires a deposited file — generate the canonical PDF first.
    let pdf: Uint8Array | undefined;
    if (provider === 'zenodo') {
      const b = await getBulletinById(id);
      if (!b) throw badRequest('Bulletin not found.');
      if (b.status !== 'published') throw badRequest('Publish the bulletin before minting a DOI.');
      pdf = new Uint8Array(await renderBulletinPdf(b, appUrl));
    }

    const result = await mintBulletinDoi(id, { pdf, appUrl });
    return ok(result);
  } catch (err) {
    return fail(err);
  }
}
