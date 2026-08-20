import { prisma, type PrismaClient, type NotificationType } from '@researchtrics/db';

/**
 * Engagement notifications (§41). A researcher is told when their work is read,
 * downloaded, or recommended, with a coarse "from where" (country only — never a
 * reader's IP or identity, per the privacy policy). Notifications are advisory
 * and throttled so a burst of reads never floods the recipient.
 */

export interface NotifyEngagementInput {
  publicationId: string;
  type: NotificationType;
  /** Coarse location — a country, never an IP. */
  country?: string | null;
  actorLabel?: string | null;
  /** Don't notify this researcher of their own action. */
  excludeResearcherId?: string | null;
  /** Suppress a duplicate (recipient+publication+type) within this window. */
  throttleMs?: number;
}

/** Notify a publication's linked authors of an engagement event. */
export async function notifyEngagement(
  input: NotifyEngagementInput,
  client: PrismaClient = prisma,
): Promise<{ created: number }> {
  const throttleMs = input.throttleMs ?? 60 * 60_000;
  const authors = await client.publicationAuthor.findMany({
    where: { publicationId: input.publicationId, researcherId: { not: null } },
    select: { researcherId: true },
  });
  const recipients = Array.from(
    new Set(
      authors
        .map((a) => a.researcherId)
        .filter((id): id is string => !!id && id !== input.excludeResearcherId),
    ),
  );

  let created = 0;
  for (const recipientId of recipients) {
    const recent = await client.notification.findFirst({
      where: {
        recipientId,
        publicationId: input.publicationId,
        type: input.type,
        createdAt: { gte: new Date(Date.now() - throttleMs) },
      },
      select: { id: true },
    });
    if (recent) continue;
    await client.notification.create({
      data: {
        recipientId,
        publicationId: input.publicationId,
        type: input.type,
        country: input.country ?? null,
        actorLabel: input.actorLabel ?? 'A reader',
      },
    });
    created += 1;
  }
  return { created };
}

export interface NotificationView {
  id: string;
  type: NotificationType;
  /** Where this notification links (publication or opportunity). */
  href: string | null;
  publicationSlug: string | null;
  publicationTitle: string | null;
  opportunitySlug: string | null;
  opportunityTitle: string | null;
  country: string | null;
  read: boolean;
  createdAt: Date;
  message: string;
}

const VERB: Partial<Record<NotificationType, string>> = {
  publication_read: 'read',
  publication_download: 'downloaded',
  publication_recommend: 'recommended',
  citation: 'cited',
};

/** A human sentence for a notification (no personal data — country only). */
export function describeNotification(n: {
  type: NotificationType;
  country: string | null;
  publicationTitle: string | null;
  opportunityTitle?: string | null;
  opportunityType?: string | null;
  actorLabel?: string | null;
}): string {
  if (n.type === 'collaboration_request') {
    const who = n.actorLabel ?? 'A researcher';
    return `${who} wants to collaborate with you.`;
  }
  if (n.type === 'opportunity_match') {
    const kind = (n.opportunityType ?? 'opportunity').replace(/_/g, ' ');
    const what = n.opportunityTitle ? `: “${n.opportunityTitle}”` : '';
    return `A new ${kind} matches your interests${what}.`;
  }
  const what = n.publicationTitle ? `“${n.publicationTitle}”` : 'your work';
  const where = n.country ? ` from ${n.country}` : '';
  return `Someone ${VERB[n.type] ?? 'engaged with'} ${what}${where}.`;
}

export async function listNotifications(
  recipientId: string,
  opts: { take?: number } = {},
  client: PrismaClient = prisma,
): Promise<NotificationView[]> {
  const rows = await client.notification.findMany({
    where: { recipientId },
    orderBy: { createdAt: 'desc' },
    take: opts.take ?? 50,
    include: {
      publication: { select: { title: true, slug: true } },
      opportunity: { select: { title: true, slug: true, type: true } },
    },
  });
  return rows.map((n) => ({
    id: n.id,
    type: n.type,
    href: n.opportunity
      ? `/opportunities/${n.opportunity.slug}`
      : n.publication
        ? `/publications/${n.publication.slug}`
        : n.type === 'collaboration_request'
          ? '/dashboard/collaborate'
          : null,
    publicationSlug: n.publication?.slug ?? null,
    publicationTitle: n.publication?.title ?? null,
    opportunitySlug: n.opportunity?.slug ?? null,
    opportunityTitle: n.opportunity?.title ?? null,
    country: n.country,
    read: n.readAt !== null,
    createdAt: n.createdAt,
    message: describeNotification({
      type: n.type,
      country: n.country,
      publicationTitle: n.publication?.title ?? null,
      opportunityTitle: n.opportunity?.title ?? null,
      opportunityType: n.opportunity?.type ?? null,
      actorLabel: n.actorLabel,
    }),
  }));
}

export async function countUnreadNotifications(
  recipientId: string,
  client: PrismaClient = prisma,
): Promise<number> {
  return client.notification.count({ where: { recipientId, readAt: null } });
}

/** Mark notifications read (all, or a specific set). Returns how many changed. */
export async function markNotificationsRead(
  recipientId: string,
  ids?: string[],
  client: PrismaClient = prisma,
): Promise<number> {
  const res = await client.notification.updateMany({
    where: { recipientId, readAt: null, ...(ids && ids.length > 0 ? { id: { in: ids } } : {}) },
    data: { readAt: new Date() },
  });
  return res.count;
}
