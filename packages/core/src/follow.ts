import { prisma, type PrismaClient } from '@researchtrics/db';
import { badRequest, notFound } from './errors';

/**
 * Following (§18) — a lightweight social edge: one researcher follows another to
 * see their work. Distinct from collaboration requests (which need consent) and
 * co-authorship. Following notifies the followed researcher.
 */

export interface FollowState {
  isFollowing: boolean;
  followers: number;
  following: number;
}

export async function isFollowing(
  followerId: string,
  followedId: string,
  client: PrismaClient = prisma,
): Promise<boolean> {
  if (!followerId || followerId === followedId) return false;
  const row = await client.follow.findUnique({
    where: { followerId_followedId: { followerId, followedId } },
    select: { id: true },
  });
  return !!row;
}

export async function countFollowers(researcherId: string, client: PrismaClient = prisma): Promise<number> {
  return client.follow.count({ where: { followedId: researcherId } });
}

export async function countFollowing(researcherId: string, client: PrismaClient = prisma): Promise<number> {
  return client.follow.count({ where: { followerId: researcherId } });
}

/** Follower/following counts for a profile, plus whether the viewer follows it. */
export async function getFollowState(
  targetId: string,
  viewerResearcherId: string | null,
  client: PrismaClient = prisma,
): Promise<FollowState> {
  const [followers, following, viewerFollows] = await Promise.all([
    countFollowers(targetId, client),
    countFollowing(targetId, client),
    viewerResearcherId ? isFollowing(viewerResearcherId, targetId, client) : Promise.resolve(false),
  ]);
  return { isFollowing: viewerFollows, followers, following };
}

/** Follow a researcher (idempotent). Notifies the followed researcher. */
export async function followResearcher(
  followerId: string,
  followedId: string,
  client: PrismaClient = prisma,
): Promise<{ following: true }> {
  if (followerId === followedId) throw badRequest('You cannot follow yourself.');
  const target = await client.researcher.findUnique({ where: { id: followedId }, select: { id: true } });
  if (!target) throw notFound('Researcher not found.');

  const existing = await client.follow.findUnique({
    where: { followerId_followedId: { followerId, followedId } },
    select: { id: true },
  });
  if (existing) return { following: true };

  const follower = await client.researcher.findUnique({
    where: { id: followerId },
    select: { displayName: true },
  });
  await client.follow.create({ data: { followerId, followedId } });

  // Alert the followed researcher (§41). Non-fatal.
  await client.notification
    .create({
      data: {
        recipientId: followedId,
        type: 'follow',
        actorLabel: follower?.displayName ?? 'A researcher',
      },
    })
    .catch(() => undefined);

  return { following: true };
}

/** Unfollow a researcher (idempotent). */
export async function unfollowResearcher(
  followerId: string,
  followedId: string,
  client: PrismaClient = prisma,
): Promise<{ following: false }> {
  await client.follow
    .delete({ where: { followerId_followedId: { followerId, followedId } } })
    .catch(() => undefined);
  return { following: false };
}
