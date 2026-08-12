import { prisma, type PrismaClient } from '@researchtrics/db';
import { conflict, badRequest, notFound } from './errors';

/**
 * Research collaboration (Spec §18). Recommendations are rule-based and ALWAYS
 * explained — never an unexplained score (Spec §18, §29). Matching complements
 * existing collaborators rather than resurfacing them.
 */

export interface CollaboratorSignals {
  sharedInterests: string[];
  sameInstitution?: boolean;
  institutionName?: string | undefined;
  sameCountry?: boolean;
  country?: string | undefined;
}

export interface CollaboratorScore {
  score: number; // 0..1
  reasons: string[];
}

/** Score a candidate and produce human-readable reasons. Pure + tested. */
export function scoreCollaborator(signals: CollaboratorSignals): CollaboratorScore {
  const reasons: string[] = [];
  let score = 0;

  const shared = signals.sharedInterests.filter(Boolean);
  if (shared.length > 0) {
    // Diminishing returns; interests are the primary signal.
    score += Math.min(0.75, shared.length * 0.3);
    const list = shared.slice(0, 3).join(', ');
    reasons.push(
      shared.length === 1
        ? `You both list the research interest "${list}"`
        : `You share ${shared.length} research interests (${list}${shared.length > 3 ? ', …' : ''})`,
    );
  }
  if (signals.sameInstitution) {
    score += 0.15;
    reasons.push(
      signals.institutionName
        ? `Both affiliated with ${signals.institutionName}`
        : 'Affiliated with the same institution',
    );
  }
  if (signals.sameCountry && !signals.sameInstitution) {
    score += 0.08;
    if (signals.country) reasons.push(`Both based in ${signals.country}`);
  }

  return { score: Math.min(1, score), reasons };
}

export interface CollaboratorRecommendation {
  researcherId: string;
  slug: string;
  displayName: string;
  academicRank: string | null;
  score: number;
  reasons: string[];
}

/**
 * Recommend potential collaborators for a researcher, each with an explanation.
 * Excludes self, existing co-authors, and researchers already in a request.
 */
export async function recommendCollaborators(
  researcherId: string,
  limit = 10,
  client: PrismaClient = prisma,
): Promise<CollaboratorRecommendation[]> {
  const me = await client.researcher.findUnique({
    where: { id: researcherId },
    include: {
      interests: { select: { label: true } },
      affiliations: { select: { institutionId: true } },
    },
  });
  if (!me) return [];

  const myLabels = me.interests.map((i) => i.label);
  const myInstIds = me.affiliations.map((a) => a.institutionId);

  // Build the exclusion set: self, co-authors, and anyone already in a request.
  const excluded = new Set<string>([researcherId]);
  const [reqs, coAuthors] = await Promise.all([
    client.collaborationRequest.findMany({
      where: { OR: [{ fromResearcherId: researcherId }, { toResearcherId: researcherId }] },
      select: { fromResearcherId: true, toResearcherId: true },
    }),
    client.publicationAuthor.findMany({
      where: { researcherId: { not: null }, publication: { authors: { some: { researcherId } } } },
      select: { researcherId: true },
    }),
  ]);
  reqs.forEach((r) => {
    excluded.add(r.fromResearcherId);
    excluded.add(r.toResearcherId);
  });
  coAuthors.forEach((a) => a.researcherId && excluded.add(a.researcherId));

  const candidates = new Map<
    string,
    { shared: Set<string>; sameInstitution: boolean; institutionName?: string }
  >();

  // 1) Researchers sharing at least one interest.
  if (myLabels.length > 0) {
    const rows = await client.researchInterest.findMany({
      where: {
        label: { in: myLabels },
        researcher: { deletedAt: null, profileVisibility: 'public' },
      },
      select: { researcherId: true, label: true },
    });
    for (const r of rows) {
      if (excluded.has(r.researcherId)) continue;
      const c = candidates.get(r.researcherId) ?? { shared: new Set(), sameInstitution: false };
      c.shared.add(r.label);
      candidates.set(r.researcherId, c);
    }
  }

  // 2) Researchers at the same institution (adds a signal / seeds candidates).
  if (myInstIds.length > 0) {
    const rows = await client.affiliation.findMany({
      where: {
        institutionId: { in: myInstIds },
        researcher: { deletedAt: null, profileVisibility: 'public' },
      },
      select: { researcherId: true, institution: { select: { name: true } } },
    });
    for (const r of rows) {
      if (excluded.has(r.researcherId)) continue;
      const c = candidates.get(r.researcherId) ?? { shared: new Set(), sameInstitution: false };
      c.sameInstitution = true;
      c.institutionName = r.institution.name;
      candidates.set(r.researcherId, c);
    }
  }

  if (candidates.size === 0) return [];

  const infos = await client.researcher.findMany({
    where: { id: { in: [...candidates.keys()] }, deletedAt: null, profileVisibility: 'public' },
    select: { id: true, slug: true, displayName: true, academicRank: true, country: true },
  });

  const recs = infos
    .map((info) => {
      const c = candidates.get(info.id)!;
      const { score, reasons } = scoreCollaborator({
        sharedInterests: [...c.shared],
        sameInstitution: c.sameInstitution,
        institutionName: c.institutionName,
      });
      return {
        researcherId: info.id,
        slug: info.slug,
        displayName: info.displayName,
        academicRank: info.academicRank,
        score,
        reasons,
      };
    })
    .filter((r) => r.reasons.length > 0) // never surface an unexplained recommendation
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return recs;
}

// ---------- Collaboration requests ----------

export async function createCollaborationRequest(
  fromResearcherId: string,
  toResearcherId: string,
  message: string | null,
  client: PrismaClient = prisma,
): Promise<{ id: string }> {
  if (fromResearcherId === toResearcherId) throw badRequest('You cannot send a request to yourself');
  const target = await client.researcher.findUnique({ where: { id: toResearcherId }, select: { id: true } });
  if (!target) throw notFound('Researcher not found');

  const existing = await client.collaborationRequest.findUnique({
    where: { fromResearcherId_toResearcherId: { fromResearcherId, toResearcherId } },
  });
  if (existing) throw conflict('You have already sent this researcher a request');

  const created = await client.collaborationRequest.create({
    data: { fromResearcherId, toResearcherId, message },
  });
  return { id: created.id };
}

export async function listIncomingRequests(researcherId: string, client: PrismaClient = prisma) {
  return client.collaborationRequest.findMany({
    where: { toResearcherId: researcherId, status: 'pending' },
    include: { from: { select: { slug: true, displayName: true, academicRank: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function listOutgoingRequests(researcherId: string, client: PrismaClient = prisma) {
  return client.collaborationRequest.findMany({
    where: { fromResearcherId: researcherId },
    include: { to: { select: { slug: true, displayName: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

/** Accept or decline a request. Only the recipient may respond. */
export async function respondToRequest(
  requestId: string,
  researcherId: string,
  accept: boolean,
  client: PrismaClient = prisma,
): Promise<void> {
  const req = await client.collaborationRequest.findUnique({ where: { id: requestId } });
  if (!req || req.toResearcherId !== researcherId) throw notFound('Request not found');
  if (req.status !== 'pending') throw badRequest('This request has already been answered');

  await client.$transaction([
    client.collaborationRequest.update({
      where: { id: requestId },
      data: { status: accept ? 'accepted' : 'declined', respondedAt: new Date() },
    }),
    client.auditLog.create({
      data: {
        actorId: null,
        action: accept ? 'collaboration.accept' : 'collaboration.decline',
        entityType: 'collaboration_request',
        entityId: requestId,
        after: { status: accept ? 'accepted' : 'declined' },
      },
    }),
  ]);
}
