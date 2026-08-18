import { prisma, type PrismaClient } from '@researchtrics/db';
import { getEmailProvider, type EmailMessage } from './email';
import { logger } from './logger';

/**
 * Weekly engagement digest (§41): a batched email of how a researcher's work was
 * engaged with — "read 12× incl. from Nigeria and Germany." Only sent to
 * registered, email-VERIFIED users (never to discovered/unclaimed profiles), and
 * only when there's activity. Country-level only; no reader identities.
 */

export interface EngagementDigest {
  researcherId: string;
  displayName: string;
  email: string;
  sinceDays: number;
  total: number;
  reads: number;
  downloads: number;
  recommends: number;
  countries: string[];
  topPublications: Array<{ title: string; slug: string; count: number }>;
  opportunities: Array<{ title: string; slug: string; type: string }>;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** Aggregate a researcher's recent notifications into a digest, or null if none. */
export async function buildEngagementDigest(
  researcherId: string,
  sinceDays = 7,
  client: PrismaClient = prisma,
): Promise<EngagementDigest | null> {
  const researcher = await client.researcher.findUnique({
    where: { id: researcherId },
    select: { displayName: true, user: { select: { email: true, emailVerified: true } } },
  });
  if (!researcher?.user?.emailVerified) return null; // only verified, registered users

  const since = new Date(Date.now() - sinceDays * 86_400_000);
  const notifs = await client.notification.findMany({
    where: { recipientId: researcherId, createdAt: { gte: since } },
    include: {
      publication: { select: { title: true, slug: true } },
      opportunity: { select: { title: true, slug: true, type: true } },
    },
  });
  if (notifs.length === 0) return null;

  const count = (t: string) => notifs.filter((n) => n.type === t).length;
  const countries = Array.from(
    new Set(notifs.map((n) => n.country).filter((c): c is string => !!c)),
  ).slice(0, 6);

  const pubMap = new Map<string, { title: string; slug: string; count: number }>();
  for (const n of notifs) {
    if (!n.publication) continue;
    const e = pubMap.get(n.publication.slug) ?? { title: n.publication.title, slug: n.publication.slug, count: 0 };
    e.count += 1;
    pubMap.set(n.publication.slug, e);
  }

  const oppMap = new Map<string, { title: string; slug: string; type: string }>();
  for (const n of notifs) {
    if (n.type !== 'opportunity_match' || !n.opportunity) continue;
    oppMap.set(n.opportunity.slug, {
      title: n.opportunity.title,
      slug: n.opportunity.slug,
      type: n.opportunity.type,
    });
  }

  return {
    researcherId,
    displayName: researcher.displayName,
    email: researcher.user.email,
    sinceDays,
    total: notifs.length,
    reads: count('publication_read'),
    downloads: count('publication_download'),
    recommends: count('publication_recommend'),
    countries,
    topPublications: [...pubMap.values()].sort((a, b) => b.count - a.count).slice(0, 5),
    opportunities: [...oppMap.values()].slice(0, 5),
  };
}

export function engagementDigestTemplate(d: EngagementDigest, appUrl: string): Omit<EmailMessage, 'to'> {
  const engagement = d.reads + d.downloads + d.recommends;
  const parts: string[] = [];
  if (d.reads) parts.push(`${d.reads} read${d.reads > 1 ? 's' : ''}`);
  if (d.downloads) parts.push(`${d.downloads} download${d.downloads > 1 ? 's' : ''}`);
  if (d.recommends) parts.push(`${d.recommends} recommendation${d.recommends > 1 ? 's' : ''}`);
  const summary = parts.join(', ') || `${engagement} interactions`;
  const where = d.countries.length ? ` including from ${d.countries.join(', ')}` : '';

  // Subject leads with whichever signal is present. Engagement wins when both
  // exist; opportunity-only weeks get an opportunity-led subject.
  const subject =
    engagement > 0
      ? `Your research reached ${engagement} ${engagement === 1 ? 'reader' : 'readers'} this week`
      : `${d.opportunities.length} new ${d.opportunities.length === 1 ? 'opportunity' : 'opportunities'} match your work`;

  const oppLabel = (t: string) => t.replace(/_/g, ' ');
  const pubText = d.topPublications.map((p) => `• ${p.title} — ${p.count}`).join('\n');
  const oppText = d.opportunities.map((o) => `• ${o.title} (${oppLabel(o.type)})`).join('\n');

  const engagementBlock =
    engagement > 0
      ? `In the last ${d.sinceDays} days your work saw ${summary}${where}.\n\n${pubText}\n\n`
      : '';
  const oppBlock = d.opportunities.length
    ? `New opportunities matched to your interests:\n${oppText}\n\nBrowse all: ${appUrl}/opportunities\n\n`
    : '';
  const text =
    `Hi ${d.displayName},\n\n` +
    engagementBlock +
    oppBlock +
    `See details: ${appUrl}/notifications\n\n` +
    `— ResearchTrics\nManage emails: ${appUrl}/dashboard/profile`;

  const pubHtml = d.topPublications.map((p) => `<li>${escapeHtml(p.title)} — ${p.count}</li>`).join('');
  const oppHtml = d.opportunities
    .map((o) => `<li>${escapeHtml(o.title)} <span style="color:#888">(${escapeHtml(oppLabel(o.type))})</span></li>`)
    .join('');
  const engagementHtml =
    engagement > 0
      ? `<p>In the last ${d.sinceDays} days your work saw <strong>${escapeHtml(summary)}</strong>${escapeHtml(where)}.</p>` +
        (pubHtml ? `<ul>${pubHtml}</ul>` : '')
      : '';
  const oppHtmlBlock = d.opportunities.length
    ? `<p><strong>New opportunities</strong> matched to your interests:</p><ul>${oppHtml}</ul>` +
      `<p><a href="${appUrl}/opportunities">Browse all opportunities</a></p>`
    : '';
  const html =
    `<p>Hi ${escapeHtml(d.displayName)},</p>` +
    engagementHtml +
    oppHtmlBlock +
    `<p><a href="${appUrl}/notifications">See details</a></p>` +
    `<p style="font-size:12px;color:#888">— ResearchTrics · <a href="${appUrl}/dashboard/profile">manage emails</a></p>`;

  return { subject, text, html };
}

/** Build + send digests for every researcher with recent activity. */
export async function sendEngagementDigests(
  sinceDays = 7,
  appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.researchtrics.com',
  client: PrismaClient = prisma,
): Promise<{ candidates: number; sent: number }> {
  const since = new Date(Date.now() - sinceDays * 86_400_000);
  const recipients = await client.notification.findMany({
    where: { createdAt: { gte: since } },
    distinct: ['recipientId'],
    select: { recipientId: true },
  });

  let sent = 0;
  for (const r of recipients) {
    const digest = await buildEngagementDigest(r.recipientId, sinceDays, client);
    if (!digest) continue;
    try {
      await getEmailProvider().send({ to: digest.email, ...engagementDigestTemplate(digest, appUrl) });
      sent += 1;
    } catch (err) {
      logger.warn({ err, to: digest.email }, 'Engagement digest send failed');
    }
  }
  logger.info({ candidates: recipients.length, sent }, 'Engagement digests dispatched');
  return { candidates: recipients.length, sent };
}
