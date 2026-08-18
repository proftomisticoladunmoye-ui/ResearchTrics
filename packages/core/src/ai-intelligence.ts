import { prisma, type PrismaClient } from '@researchtrics/db';
import {
  createAIProvider,
  type AIGeneration,
  type GroundedContext,
  type GroundedFact,
} from '@researchtrics/ai';
import { loadServerEnv } from '@researchtrics/config';
import { logger } from './logger';
import { notFound } from './errors';

/**
 * AI Research Intelligence (Spec §29, §48, §92).
 *
 * Every feature here is **grounded** and **explained**: the AI is only ever
 * given verified platform records, its output cites the records it drew on, and
 * it never invents a publication, citation, metric, or affiliation. Only public
 * records are assembled into AI context, so no private researcher data is sent
 * to any provider (Spec §92). The provider is pluggable (Spec §48) and defaults
 * to an on-platform provider that requires no external calls.
 */

// ---------- Record gathering (public records only, Spec §92) ----------

interface ResearcherRecords {
  researchtricsId: string;
  displayName: string;
  country: string | null;
  academicRank: string | null;
  interests: string[];
  affiliations: Array<{ institution: string; country: string | null }>;
  publications: Array<{ ref: string; title: string; year: number | null }>;
  outputs: { datasets: number; instruments: number; software: number; projects: number };
}

async function gatherRecords(
  researcherId: string,
  client: PrismaClient,
): Promise<ResearcherRecords> {
  const researcher = await client.researcher.findUnique({
    where: { id: researcherId },
    include: {
      interests: { orderBy: { label: 'asc' } },
      affiliations: {
        include: { institution: { select: { name: true, country: true } } },
        orderBy: [{ isPrimary: 'desc' }, { startDate: 'desc' }],
      },
      _count: {
        select: {
          datasetsCreated: true,
          instrumentsAuthored: true,
          softwareAuthored: true,
          projectsLed: true,
        },
      },
    },
  });
  if (!researcher) throw notFound('Researcher not found');

  // Only public publications feed the AI context (Spec §92).
  const publications = await client.publication.findMany({
    where: { deletedAt: null, visibility: 'public', authors: { some: { researcherId } } },
    select: { publicId: true, title: true, publishedYear: true },
    orderBy: [{ publishedYear: 'desc' }, { title: 'asc' }],
  });

  return {
    researchtricsId: researcher.researchtricsId,
    displayName: researcher.displayName,
    country: researcher.country,
    academicRank: researcher.academicRank,
    interests: researcher.interests.map((i) => i.label),
    affiliations: researcher.affiliations.map((a) => ({
      institution: a.institution?.name ?? 'an institution',
      country: a.institution?.country ?? null,
    })),
    publications: publications.map((p, idx) => ({
      ref: p.publicId ?? `pub:${idx}`,
      title: p.title,
      year: p.publishedYear,
    })),
    outputs: {
      datasets: researcher._count.datasetsCreated,
      instruments: researcher._count.instrumentsAuthored,
      software: researcher._count.softwareAuthored,
      projects: researcher._count.projectsLed,
    },
  };
}

/** Turn verified records into self-contained factual clauses (the grounding set). */
function buildFacts(r: ResearcherRecords): GroundedFact[] {
  const facts: GroundedFact[] = [];

  const rank = r.academicRank ? `${r.academicRank}, ` : '';
  const place = r.country ? ` based in ${r.country}` : '';
  facts.push({
    ref: r.researchtricsId,
    kind: 'profile',
    text: `${r.displayName} (${rank}${r.researchtricsId})${place} is a researcher on ResearchTrics`,
  });

  for (const a of r.affiliations) {
    const country = a.country ? ` (${a.country})` : '';
    facts.push({
      ref: `aff:${a.institution}`,
      kind: 'affiliation',
      text: `Affiliated with ${a.institution}${country}`,
    });
  }

  if (r.interests.length > 0) {
    facts.push({
      ref: 'interests',
      kind: 'interest',
      text: `Lists research interests: ${r.interests.join(', ')}`,
    });
  }

  if (r.publications.length > 0) {
    const recent = r.publications.slice(0, 3);
    const examples = recent
      .map((p) => `"${p.title}"${p.year ? ` (${p.year})` : ''}`)
      .join(', ');
    const noun = r.publications.length === 1 ? 'publication' : 'publications';
    facts.push({
      ref: recent[0]!.ref,
      kind: 'publication',
      text: `Has ${r.publications.length} ${noun} recorded, including ${examples}`,
    });
  }

  const o = r.outputs;
  const outputParts: string[] = [];
  if (o.projects > 0) outputParts.push(`${o.projects} research project(s)`);
  if (o.datasets > 0) outputParts.push(`${o.datasets} dataset(s)`);
  if (o.instruments > 0) outputParts.push(`${o.instruments} instrument(s)`);
  if (o.software > 0) outputParts.push(`${o.software} software output(s)`);
  if (outputParts.length > 0) {
    facts.push({
      ref: 'outputs',
      kind: 'output',
      text: `Also curates ${outputParts.join(', ')} on the platform`,
    });
  }

  return facts;
}

// ---------- Expertise extraction (pure, grounded, tested) ----------

export interface ExpertiseTerm {
  term: string;
  /** Relative strength — higher means more evidence in the records. */
  weight: number;
  /** Source refs the term is grounded in (a stated interest and/or publication titles). */
  evidence: string[];
}

// Words that carry no topical signal in a title.
const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'of', 'in', 'on', 'for', 'to', 'with', 'from', 'by', 'at',
  'as', 'is', 'are', 'was', 'were', 'be', 'been', 'this', 'that', 'these', 'those', 'its',
  'study', 'studies', 'analysis', 'approach', 'using', 'towards', 'toward', 'via', 'case',
  'new', 'novel', 'review', 'paper', 'research', 'into', 'between', 'across', 'their', 'our',
]);

/**
 * Extract a researcher's likely areas of expertise strictly from their stated
 * interests and the titles of their recorded publications. Nothing is inferred
 * beyond what the records literally contain, and every term cites its evidence
 * (Spec §29). Pure and deterministic — no I/O, no provider.
 */
export function extractExpertise(input: {
  interests: string[];
  titles: Array<{ ref: string; title: string }>;
}): ExpertiseTerm[] {
  const byTerm = new Map<string, { weight: number; evidence: Set<string> }>();

  const bump = (raw: string, weight: number, ref: string) => {
    const term = raw.trim().toLowerCase();
    if (!term) return;
    const entry = byTerm.get(term) ?? { weight: 0, evidence: new Set<string>() };
    entry.weight += weight;
    entry.evidence.add(ref);
    byTerm.set(term, entry);
  };

  // Stated interests are the strongest, first-party signal.
  for (const interest of input.interests) {
    const clean = interest.trim();
    if (clean) bump(clean, 3, 'interests');
  }

  // Title keywords: significant single words that recur across titles.
  for (const { ref, title } of input.titles) {
    const words = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !STOPWORDS.has(w));
    const seen = new Set<string>();
    for (const w of words) {
      if (seen.has(w)) continue; // count each word once per title
      seen.add(w);
      // Reinforce an existing interest term, or introduce a title-derived one.
      bump(w, byTerm.has(w) ? 2 : 1, ref);
    }
  }

  return Array.from(byTerm.entries())
    .map(([term, { weight, evidence }]) => ({ term, weight, evidence: Array.from(evidence).sort() }))
    // Keep only terms with real evidence: a stated interest, or a word seen in ≥2 titles.
    .filter((t) => t.evidence.includes('interests') || t.weight >= 2)
    .sort((a, b) => b.weight - a.weight || a.term.localeCompare(b.term))
    .slice(0, 8);
}

// ---------- Provider resolution ----------

function resolveProvider() {
  const env = loadServerEnv();
  const { provider, fellBack } = createAIProvider({
    provider: env.AI_PROVIDER,
    apiKey: env.AI_API_KEY,
    model: env.AI_MODEL,
    baseUrl: env.AI_BASE_URL,
  });
  if (fellBack) {
    logger.warn('An external AI_PROVIDER was set but AI_API_KEY is unset — using the on-platform provider');
  }
  return { provider, fellBack };
}

// ---------- Profile summarization ----------

export interface ProfileSummary {
  generation: AIGeneration;
  /** Provider name surfaced in the trust label. */
  providerName: string;
  /** True if produced by an external service. */
  external: boolean;
  /** True if a Claude provider was requested but no key was configured. */
  fellBack: boolean;
  /** The grounding set that produced the summary — every claim traces here. */
  facts: GroundedFact[];
}

/**
 * Produce a grounded, third-person summary of a researcher's public profile.
 * The summary is an AI *interpretation* of the records — it is labelled as such
 * in the UI and never presented as a verified fact (Spec §64).
 */
export async function summarizeProfile(
  researcherId: string,
  client: PrismaClient = prisma,
): Promise<ProfileSummary> {
  const records = await gatherRecords(researcherId, client);
  const facts = buildFacts(records);
  const { provider, fellBack } = resolveProvider();

  const ctx: GroundedContext = {
    task: 'profile-summary',
    instruction:
      'Write a concise, factual summary of this researcher for their public profile.',
    facts,
    containsPrivate: false,
  };

  const generation = await provider.generateGrounded(ctx);

  return {
    generation,
    providerName: provider.name,
    external: provider.external,
    fellBack,
    facts,
  };
}

// ---------- Background precompute (worker, §29/§48) ----------

/**
 * Generate and CACHE a researcher's grounded profile summary. Runs in the
 * background (worker) so profile pages never call an LLM on request, and so the
 * cost of any external provider (e.g. OpenRouter) is paid once per refresh, not
 * per view. Profiles too sparse to summarize are stamped (so they aren't
 * re-scanned every run) but store no summary text.
 */
export async function precomputeProfileSummary(
  researcherId: string,
  client: PrismaClient = prisma,
): Promise<{ updated: boolean; empty: boolean; model: string }> {
  const records = await gatherRecords(researcherId, client);
  const facts = buildFacts(records);

  // A lone profile fact means no real content to summarize — skip generation.
  const hasContent = facts.length > 1;
  if (!hasContent) {
    await client.researcher.update({
      where: { id: researcherId },
      data: { aiSummaryAt: new Date(), aiSummary: null, aiSummaryModel: null },
    });
    return { updated: false, empty: true, model: 'none' };
  }

  const { provider } = resolveProvider();
  const generation = await provider.generateGrounded({
    task: 'profile-summary',
    instruction: 'Write a concise, factual summary of this researcher for their public profile.',
    facts,
    containsPrivate: false,
  });

  const text = generation.text.trim();
  await client.researcher.update({
    where: { id: researcherId },
    data: {
      aiSummary: text || null,
      aiSummaryModel: text ? generation.model : null,
      aiSummaryAt: new Date(),
    },
  });
  return { updated: !!text, empty: !text, model: generation.model };
}

/**
 * Batch-refresh cached profile summaries for researchers that have never been
 * summarized or whose summary is stale. Bounded by `limit`; safe to run daily.
 */
export async function precomputeProfileSummaries(
  opts: { limit?: number; staleAfterDays?: number } = {},
  client: PrismaClient = prisma,
): Promise<{ processed: number; updated: number; skipped: number }> {
  const limit = opts.limit ?? 50;
  const staleBefore = new Date(Date.now() - (opts.staleAfterDays ?? 30) * 86_400_000);

  const candidates = await client.researcher.findMany({
    where: {
      deletedAt: null,
      profileVisibility: 'public',
      OR: [{ aiSummaryAt: null }, { aiSummaryAt: { lt: staleBefore } }],
    },
    // Oldest / never-summarized first.
    orderBy: [{ aiSummaryAt: { sort: 'asc', nulls: 'first' } }],
    select: { id: true },
    take: limit,
  });

  let updated = 0;
  let skipped = 0;
  for (const c of candidates) {
    try {
      const r = await precomputeProfileSummary(c.id, client);
      if (r.updated) updated += 1;
      else skipped += 1;
    } catch (err) {
      skipped += 1;
      logger.warn({ err, researcherId: c.id }, 'Profile summary precompute failed');
    }
  }
  return { processed: candidates.length, updated, skipped };
}

// ---------- Bundle for the dashboard ----------

export interface ResearcherIntelligence {
  summary: ProfileSummary;
  expertise: ExpertiseTerm[];
  /** Number of verified records the intelligence is grounded in. */
  groundedRecordCount: number;
}

export async function getResearcherIntelligence(
  researcherId: string,
  client: PrismaClient = prisma,
): Promise<ResearcherIntelligence> {
  const records = await gatherRecords(researcherId, client);
  const facts = buildFacts(records);
  const { provider, fellBack } = resolveProvider();

  const generation = await provider.generateGrounded({
    task: 'profile-summary',
    instruction:
      'Write a concise, factual summary of this researcher for their public profile.',
    facts,
    containsPrivate: false,
  });

  const expertise = extractExpertise({
    interests: records.interests,
    titles: records.publications.map((p) => ({ ref: p.ref, title: p.title })),
  });

  return {
    summary: {
      generation,
      providerName: provider.name,
      external: provider.external,
      fellBack,
      facts,
    },
    expertise,
    groundedRecordCount: facts.length,
  };
}
