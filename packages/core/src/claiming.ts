import { prisma, type PrismaClient, type Prisma } from '@researchtrics/db';
import { hashPassword } from './password';
import { recordSuppression } from './discovery';
import { badRequest, conflict, forbidden, notFound, validationError } from './errors';

/**
 * Profile claiming & verification (Discovery Engine §11–§16, §35, §44–§48).
 *
 * A discovered profile is UNCLAIMED until a researcher proves ownership. Claims
 * are only completed on real evidence — a matching **verified** ORCID (never a
 * typed one, §12) or a verified institutional email (§13). Publication claiming
 * associates/dissociates a researcher without ever deleting the global record
 * (§15). Nothing here ever says "we know this is you" before verification (§68).
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Create a user account with **no researcher** — the account someone makes to
 * *claim* a discovered profile (rather than register a fresh one). Gets the
 * default researcher role.
 */
export async function registerClaimant(
  input: { email: string; password: string },
  client: PrismaClient = prisma,
): Promise<{ userId: string }> {
  const email = input.email.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) throw validationError('A valid email address is required');
  const existing = await client.user.findUnique({ where: { email } });
  if (existing) throw conflict('An account with this email already exists');
  const passwordHash = await hashPassword(input.password).catch(() => {
    throw validationError('Password must be at least 10 characters');
  });

  const user = await client.$transaction(async (tx) => {
    const u = await tx.user.create({ data: { email, passwordHash, status: 'active' } });
    await tx.userRole.create({ data: { userId: u.id, role: 'researcher', scopeType: 'global' } });
    return u;
  });
  return { userId: user.id };
}

/** Mark a discovered profile as being claimed (Discovery Engine §11). */
export async function startClaim(
  researcherId: string,
  userId: string,
  client: PrismaClient = prisma,
): Promise<void> {
  const r = await loadClaimable(researcherId, client);
  if (r.userId && r.userId !== userId) throw conflict('This profile has already been claimed');
  await client.researcher.update({
    where: { id: researcherId },
    data: { profileStatus: 'claim_pending' },
  });
}

async function loadClaimable(researcherId: string, client: PrismaClient) {
  const r = await client.researcher.findUnique({
    where: { id: researcherId },
    include: { identifiers: true },
  });
  if (!r || r.deletedAt) throw notFound('Profile not found');
  if (r.profileStatus === 'suppressed') throw forbidden('This profile has been removed');
  return r;
}

export type ClaimMethod =
  | { method: 'orcid'; verifiedOrcid: string }
  | { method: 'institution'; verifiedEmail: string };

export interface ClaimResult {
  researcherId: string;
  slug: string;
  profileStatus: string;
  verificationLevel: number;
}

/**
 * Complete a claim with verified evidence. The claiming user must not already
 * own a different researcher (that is a *merge*, handled by the review flow —
 * Discovery Engine §24/§57). ORCID claims require the discovered profile to
 * already carry the *same* ORCID — a typed ORCID never claims a profile (§12).
 */
export async function claimProfile(
  researcherId: string,
  userId: string,
  evidence: ClaimMethod,
  client: PrismaClient = prisma,
): Promise<ClaimResult> {
  const r = await loadClaimable(researcherId, client);
  if (r.userId && r.userId !== userId) throw conflict('This profile has already been claimed');

  const usersResearcher = await client.researcher.findFirst({
    where: { userId, deletedAt: null, NOT: { id: researcherId } },
    select: { id: true },
  });
  if (usersResearcher) {
    throw conflict(
      'Your account already has a research profile. Merging a discovered profile into an existing account is coming soon.',
    );
  }

  let profileStatus: 'verified' | 'claimed';
  let verificationLevel: number;
  let method: string;
  let evidenceRef: string | null = null;

  if (evidence.method === 'orcid') {
    const orcid = evidence.verifiedOrcid.trim();
    const hasMatchingOrcid = r.identifiers.some((i) => i.scheme === 'orcid' && i.value === orcid);
    if (!hasMatchingOrcid) {
      // Never claim a profile just because a user supplied an ORCID (§12).
      throw badRequest('The verified ORCID does not match this profile');
    }
    profileStatus = 'verified';
    verificationLevel = 3; // ORCID-verified (Spec §38)
    method = 'orcid_oauth';
    evidenceRef = orcid;
  } else {
    const email = evidence.verifiedEmail.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) throw validationError('A valid institutional email is required');
    profileStatus = 'claimed';
    verificationLevel = 2; // institution-verified controls the email, not authorship (§13)
    method = 'institutional_email';
    evidenceRef = email;
  }

  await client.$transaction(async (tx) => {
    await tx.researcher.update({
      where: { id: researcherId },
      data: {
        userId,
        profileStatus,
        verificationLevel: Math.max(r.verificationLevel, verificationLevel),
      },
    });
    if (evidence.method === 'orcid') {
      await tx.researcherIdentifier.updateMany({
        where: { researcherId, scheme: 'orcid', value: evidence.verifiedOrcid.trim() },
        data: { verified: true },
      });
    }
    await tx.verificationRecord.create({
      data: { researcherId, level: verificationLevel, method, evidenceRef, verifiedById: userId },
    });
    await tx.auditLog.create({
      data: {
        actorId: userId,
        action: 'researcher.claim',
        entityType: 'researcher',
        entityId: researcherId,
        after: { method, profileStatus } as Prisma.InputJsonValue,
      },
    });
  });

  return { researcherId, slug: r.slug, profileStatus, verificationLevel };
}

// ---------- Publication claiming / dispute (§14, §15) ----------

export type PublicationClaimDecision = 'claimed' | 'disputed' | 'review';

/**
 * Record a researcher's decision about a candidate publication. `claimed`
 * associates the researcher with the authorship; `disputed` removes only *their*
 * association and never the global scholarly record (§15).
 */
export async function setPublicationClaim(
  researcherId: string,
  publicationId: string,
  decision: PublicationClaimDecision,
  reason: string | undefined,
  client: PrismaClient = prisma,
): Promise<void> {
  const pub = await client.publication.findFirst({
    where: { id: publicationId, deletedAt: null },
    select: { id: true },
  });
  if (!pub) throw notFound('Publication not found');
  const researcher = await client.researcher.findUnique({
    where: { id: researcherId },
    select: { displayName: true },
  });
  if (!researcher) throw notFound('Researcher not found');

  await client.$transaction(async (tx) => {
    await tx.researcherPublicationClaim.upsert({
      where: { researcherId_publicationId: { researcherId, publicationId } },
      create: { researcherId, publicationId, status: decision, reason: reason ?? null, decidedAt: new Date() },
      update: { status: decision, reason: reason ?? null, decidedAt: new Date() },
    });

    if (decision === 'claimed') {
      // Attach to an unclaimed authorship slot, or create a new one.
      const unmatched = await tx.publicationAuthor.findFirst({
        where: { publicationId, researcherId: null },
        orderBy: { authorOrder: 'asc' },
        select: { id: true },
      });
      if (unmatched) {
        await tx.publicationAuthor.update({ where: { id: unmatched.id }, data: { researcherId } });
      } else {
        const already = await tx.publicationAuthor.findFirst({
          where: { publicationId, researcherId },
          select: { id: true },
        });
        if (!already) {
          const max = await tx.publicationAuthor.aggregate({
            where: { publicationId },
            _max: { authorOrder: true },
          });
          await tx.publicationAuthor.create({
            data: {
              publicationId,
              researcherId,
              rawName: researcher.displayName,
              authorOrder: (max._max.authorOrder ?? -1) + 1,
            },
          });
        }
      }
    } else if (decision === 'disputed') {
      // Remove only this researcher's association; the record stays global (§15).
      await tx.publicationAuthor.updateMany({
        where: { publicationId, researcherId },
        data: { researcherId: null },
      });
    }

    await tx.auditLog.create({
      data: {
        action: `publication.${decision}`,
        entityType: 'publication',
        entityId: publicationId,
        after: { researcherId, decision, reason } as Prisma.InputJsonValue,
      },
    });
  });
}

export async function listResearcherPublicationClaims(
  researcherId: string,
  client: PrismaClient = prisma,
) {
  return client.researcherPublicationClaim.findMany({
    where: { researcherId },
    include: { publication: { select: { title: true, slug: true, publishedYear: true } } },
    orderBy: { updatedAt: 'desc' },
  });
}

// ---------- Opt-out / removal (§35) ----------

/**
 * Request removal of an UNCLAIMED profile. Suppresses it from public discovery
 * and records a minimal suppression so future syncs never recreate it. A
 * claimed profile is out of scope here — its owner manages visibility directly.
 */
export async function requestProfileRemoval(
  researcherId: string,
  reason: string | undefined,
  actorId: string | undefined,
  client: PrismaClient = prisma,
): Promise<void> {
  const r = await client.researcher.findUnique({
    where: { id: researcherId },
    include: { identifiers: true },
  });
  if (!r || r.deletedAt) throw notFound('Profile not found');
  if (r.userId || r.profileStatus === 'claimed' || r.profileStatus === 'verified') {
    throw forbidden('Claimed profiles are managed by their owner');
  }

  const orcid = r.identifiers.find((i) => i.scheme === 'orcid')?.value ?? null;
  await client.$transaction(async (tx) => {
    await recordSuppression(
      { orcid, name: r.displayName, country: r.country, reason: reason ?? 'user request', actorId: actorId ?? null },
      tx as unknown as PrismaClient,
    );
    await tx.researcher.update({
      where: { id: researcherId },
      data: { profileStatus: 'suppressed', deletedAt: new Date() },
    });
    await tx.auditLog.create({
      data: {
        actorId: actorId ?? null,
        action: 'researcher.removal',
        entityType: 'researcher',
        entityId: researcherId,
        after: { reason } as Prisma.InputJsonValue,
      },
    });
  });
}
