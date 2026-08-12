import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@researchtrics/db';
import { isAdmin, encryptSecret, unauthorized, validationError, logger } from '@researchtrics/core';
import { probeOjs } from '@researchtrics/integration-ojs';
import { ok, fail } from '@/lib/api';
import { getCurrentUser } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  name: z.string().min(2).max(160),
  baseUrl: z.string().url(),
  siteId: z.string().max(120).optional(),
  apiToken: z.string().max(500).optional(),
});

/** Register an OJS source and probe it for version/capabilities (Spec §12, §37). */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !isAdmin(user.actor)) throw unauthorized();

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw validationError('Invalid OJS source', parsed.error.flatten());

    // Probe now (best-effort) so the dashboard shows detected capabilities.
    let probe: Awaited<ReturnType<typeof probeOjs>> | null = null;
    try {
      probe = await probeOjs(parsed.data.baseUrl);
    } catch (err) {
      logger.warn({ err }, 'OJS probe failed at add-source time');
    }

    const source = await prisma.ojsSource.create({
      data: {
        name: parsed.data.name,
        baseUrl: parsed.data.baseUrl,
        siteId: parsed.data.siteId ?? null,
        apiTokenEnc: parsed.data.apiToken ? encryptSecret(parsed.data.apiToken) : null,
        oaiUrl: probe?.oaiUrl ?? null,
        versionDetected: probe?.versionDetected ?? null,
        strategy: probe?.strategy ?? null,
        restApiAvailable: probe?.restApiAvailable ?? false,
        lastProbedAt: probe ? new Date() : null,
      },
    });

    return ok({ id: source.id, versionDetected: source.versionDetected, oaiUrl: source.oaiUrl });
  } catch (err) {
    return fail(err);
  }
}
