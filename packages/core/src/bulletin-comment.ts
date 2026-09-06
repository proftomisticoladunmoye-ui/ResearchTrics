import { prisma, type PrismaClient, type BulletinCommentStatus } from '@researchtrics/db';
import { badRequest, notFound } from './errors';
import { htmlToPlainText } from './html-sanitize';

/**
 * Moderated scholarly discussion on Research Bulletins (§35). Every comment is
 * held for admin approval; nothing is public until approved. Bodies are stored
 * as plain text (all HTML stripped) to eliminate XSS from untrusted submitters.
 * Email is collected for moderation only and is NEVER returned to the public.
 */

export type { BulletinCommentStatus } from '@researchtrics/db';

const ORCID_RE = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/;

/** Whether public commenting is turned on for the deployment. */
export function bulletinCommentsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.BULLETIN_COMMENTS_ENABLED === 'true';
}

export interface CommentInput {
  authorName: string;
  authorEmail: string;
  authorAffiliation?: string | null;
  authorOrcid?: string | null;
  body: string;
}

/** Submit a comment for moderation. Returns the pending record's id. */
export async function submitBulletinComment(
  bulletinId: string,
  input: CommentInput,
  client: PrismaClient = prisma,
): Promise<{ id: string; status: BulletinCommentStatus }> {
  const name = input.authorName?.trim();
  const email = input.authorEmail?.trim().toLowerCase();
  const body = htmlToPlainText(input.body ?? '').trim(); // strip all HTML

  if (!name || name.length < 2 || name.length > 120) throw badRequest('Please provide your name.');
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw badRequest('Please provide a valid email address.');
  if (body.length < 10) throw badRequest('Your comment is too short.');
  if (body.length > 5000) throw badRequest('Your comment is too long (5000 characters max).');

  const orcid = input.authorOrcid?.trim() || null;
  if (orcid && !ORCID_RE.test(orcid)) throw badRequest('That ORCID iD is not valid (expected 0000-0000-0000-0000).');

  const bulletin = await client.researchBulletin.findFirst({
    where: { id: bulletinId, status: 'published' },
    select: { id: true },
  });
  if (!bulletin) throw notFound('Bulletin not found.');

  const created = await client.bulletinComment.create({
    data: {
      bulletinId,
      authorName: name,
      authorEmail: email,
      authorAffiliation: input.authorAffiliation?.trim() || null,
      authorOrcid: orcid,
      body,
      status: 'pending',
    },
    select: { id: true, status: true },
  });
  return created;
}

/** A public-safe comment view — no email, ever. */
export interface PublicComment {
  id: string;
  authorName: string;
  authorAffiliation: string | null;
  authorOrcid: string | null;
  body: string;
  createdAt: Date;
}

/** Approved comments for a bulletin, oldest first (public). Email excluded. */
export async function listApprovedComments(bulletinId: string, client: PrismaClient = prisma): Promise<PublicComment[]> {
  const rows = await client.bulletinComment.findMany({
    where: { bulletinId, status: 'approved' },
    orderBy: { createdAt: 'asc' },
    select: { id: true, authorName: true, authorAffiliation: true, authorOrcid: true, body: true, createdAt: true },
  });
  return rows;
}

export async function countApprovedComments(bulletinId: string, client: PrismaClient = prisma): Promise<number> {
  return client.bulletinComment.count({ where: { bulletinId, status: 'approved' } });
}

// --- Moderation (admin) -----------------------------------------------------

export interface ModerationComment extends PublicComment {
  authorEmail: string;
  status: BulletinCommentStatus;
  bulletin: { slug: string; title: string; number: number | null };
}

/** Comments awaiting (or filtered by) moderation — admin only; includes email. */
export async function listCommentsForModeration(
  status: BulletinCommentStatus = 'pending',
  client: PrismaClient = prisma,
): Promise<ModerationComment[]> {
  const rows = await client.bulletinComment.findMany({
    where: { status },
    orderBy: { createdAt: 'asc' },
    include: { bulletin: { select: { slug: true, title: true, number: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    authorName: r.authorName,
    authorEmail: r.authorEmail,
    authorAffiliation: r.authorAffiliation,
    authorOrcid: r.authorOrcid,
    body: r.body,
    createdAt: r.createdAt,
    status: r.status,
    bulletin: r.bulletin,
  }));
}

export async function countPendingComments(client: PrismaClient = prisma): Promise<number> {
  return client.bulletinComment.count({ where: { status: 'pending' } });
}

/** Approve or reject a comment (admin). Approval stamps approvedAt. */
export async function moderateBulletinComment(
  id: string,
  decision: 'approved' | 'rejected',
  client: PrismaClient = prisma,
): Promise<void> {
  const existing = await client.bulletinComment.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw notFound('Comment not found.');
  await client.bulletinComment.update({
    where: { id },
    data: { status: decision, approvedAt: decision === 'approved' ? new Date() : null },
  });
}

/** Permanently delete a comment (admin) — for spam/abuse cleanup. */
export async function deleteBulletinComment(id: string, client: PrismaClient = prisma): Promise<void> {
  await client.bulletinComment.delete({ where: { id } }).catch(() => {
    throw notFound('Comment not found.');
  });
}
