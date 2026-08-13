import { prisma, type PrismaClient, type Prisma, type ClaimChannel } from '@researchtrics/db';
import { generateClaimToken, hashClaimToken, isTokenExpired } from '@researchtrics/discovery';
import { badRequest, notFound } from './errors';

/**
 * Claim invitations & referrals (Discovery Engine §17, §18, §19).
 *
 * An invitation is a secure, single-use route to claim a discovered profile.
 * The raw token is returned once and never stored — only its hash is persisted.
 * There is **no unsolicited bulk email** here (§17); invitations are created
 * explicitly (public button, institutional invite, or a colleague referral) and
 * delivered by the caller.
 */

export interface CreateInvitationInput {
  researcherId: string;
  channel?: ClaimChannel;
  referrerUserId?: string | null;
  /** Only if legitimately obtained + consented — never a scraped address. */
  email?: string | null;
  ttlMs?: number;
}

export interface CreatedInvitation {
  id: string;
  /** Raw token — deliver to the invitee; never stored. */
  token: string;
  expiresAt: Date;
}

export async function createClaimInvitation(
  input: CreateInvitationInput,
  client: PrismaClient = prisma,
): Promise<CreatedInvitation> {
  const researcher = await client.researcher.findUnique({
    where: { id: input.researcherId },
    select: { userId: true, profileStatus: true, deletedAt: true },
  });
  if (!researcher || researcher.deletedAt) throw notFound('Profile not found');
  if (researcher.userId || researcher.profileStatus === 'claimed' || researcher.profileStatus === 'verified') {
    throw badRequest('This profile has already been claimed');
  }
  if (researcher.profileStatus === 'suppressed') throw badRequest('This profile has been removed');

  const { token, tokenHash, expiresAt } = generateClaimToken(input.ttlMs);
  const invitation = await client.claimInvitation.create({
    data: {
      researcherId: input.researcherId,
      tokenHash,
      channel: input.channel ?? 'public',
      status: 'sent',
      referrerUserId: input.referrerUserId ?? null,
      email: input.email ?? null,
      expiresAt,
    },
    select: { id: true },
  });
  return { id: invitation.id, token, expiresAt };
}

/** A colleague referral is just an invitation with the `referral` channel (§19). */
export async function createReferral(
  referrerUserId: string,
  researcherId: string,
  client: PrismaClient = prisma,
): Promise<CreatedInvitation> {
  return createClaimInvitation({ researcherId, channel: 'referral', referrerUserId }, client);
}

export interface ResolvedInvitation {
  id: string;
  status: string;
  expired: boolean;
  consumed: boolean;
  researcher: { id: string; slug: string; displayName: string; profileStatus: string };
}

/** Resolve a raw token to its invitation + target profile (Discovery Engine §18). */
export async function resolveInvitation(
  token: string,
  client: PrismaClient = prisma,
): Promise<ResolvedInvitation | null> {
  const tokenHash = hashClaimToken(token);
  const invitation = await client.claimInvitation.findUnique({
    where: { tokenHash },
    include: {
      researcher: { select: { id: true, slug: true, displayName: true, profileStatus: true } },
    },
  });
  if (!invitation) return null;
  return {
    id: invitation.id,
    status: invitation.status,
    expired: isTokenExpired(invitation.expiresAt),
    consumed: invitation.consumedAt != null,
    researcher: invitation.researcher,
  };
}

/** Mark an invitation viewed (analytics funnel, §41) — pending/sent only. */
export async function markInvitationViewed(token: string, client: PrismaClient = prisma): Promise<void> {
  await client.claimInvitation.updateMany({
    where: { tokenHash: hashClaimToken(token), status: { in: ['pending', 'sent'] } },
    data: { status: 'viewed' },
  });
}

/** Mark an invitation consumed after a successful claim (single-use, §32). */
export async function consumeInvitation(token: string, client: PrismaClient = prisma): Promise<void> {
  const tokenHash = hashClaimToken(token);
  const inv = await client.claimInvitation.findUnique({ where: { tokenHash }, select: { id: true, consumedAt: true } });
  if (!inv) throw notFound('Invitation not found');
  if (inv.consumedAt) return;
  await client.claimInvitation.update({
    where: { tokenHash },
    data: { status: 'claimed', consumedAt: new Date() },
  });
}

export async function revokeInvitation(
  id: string,
  actorId: string | undefined,
  client: PrismaClient = prisma,
): Promise<void> {
  await client.$transaction([
    client.claimInvitation.update({ where: { id }, data: { status: 'revoked' } }),
    client.auditLog.create({
      data: {
        actorId: actorId ?? null,
        action: 'invitation.revoke',
        entityType: 'claim_invitation',
        entityId: id,
        after: { status: 'revoked' } as Prisma.InputJsonValue,
      },
    }),
  ]);
}
