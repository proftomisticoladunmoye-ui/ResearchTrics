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

export interface FeedItem {
  id: string;
  slug: string;
  title: string;
  year: number | null;
  venue: string | null;
  outputType: string;
  authors: string[];
}

/**
 * A home feed of recent publications by the researchers a user follows — the
 * point of following. Public works only, newest first, deduped across authors.
 */
export async function getFollowingFeed(
  researcherId: string,
  opts: { take?: number } = {},
  client: PrismaClient = prisma,
): Promise<FeedItem[]> {
  const follows = await client.follow.findMany({
    where: { followerId: researcherId },
    select: { followedId: true },
  });
  const followedIds = follows.map((f) => f.followedId);
  if (followedIds.length === 0) return [];

  const pubs = await client.publication.findMany({
    where: {
      deletedAt: null,
      visibility: 'public',
      authors: { some: { researcherId: { in: followedIds } } },
    },
    include: {
      journal: { select: { name: true } },
      authors: { orderBy: { authorOrder: 'asc' }, select: { rawName: true }, take: 8 },
    },
    orderBy: [{ publishedYear: 'desc' }, { createdAt: 'desc' }],
    take: opts.take ?? 50,
  });

  return pubs.map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    year: p.publishedYear,
    venue: p.journal?.name ?? null,
    outputType: p.outputType,
    authors: p.authors.map((a) => a.rawName),
  }));
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
