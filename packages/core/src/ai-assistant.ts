import { prisma, type PrismaClient } from '@researchtrics/db';
import { createAIProvider, type GroundedContext, type GroundedFact } from '@researchtrics/ai';
import { loadServerEnv } from '@researchtrics/config';
import { badRequest, notFound } from './errors';
import { logger } from './logger';

/**
 * AI Assistant (§29, §48, §92) — writing and thinking help for researchers.
 *
 * This is distinct from AI *summaries* (which only restate verified records).
 * The assistant helps an author draft, refine, and plan their OWN work: it can
 * compose original prose, but under a hard never-fabricate contract — it never
 * invents citations, references, data, statistics, or results (those are marked
 * with placeholders for the author to supply). Full drafting is delivered by a
 * configured external provider (Claude); with no key it degrades to a
 * deterministic on-platform scaffold so the feature works everywhere.
 */

export type AssistantTask = 'abstract' | 'title' | 'improve' | 'questions' | 'keywords' | 'summary';

export const ASSISTANT_TASKS: readonly AssistantTask[] = [
  'abstract',
  'title',
  'improve',
  'questions',
  'keywords',
  'summary',
] as const;

const INSTRUCTIONS: Record<AssistantTask, string> = {
  abstract:
    'Draft a single structured abstract (background, aim, method, key result, conclusion) of 150–250 words from the author’s title and key points below. Where a specific statistic or result is implied but not given, insert [RESULT NEEDED]. Do not invent numbers or citations.',
  title:
    'Propose 5 clear, specific, publishable title options for the work described below. Vary emphasis (descriptive vs. finding-led). Return a numbered list only.',
  improve:
    'Rewrite the passage below in clear, concise, formal academic English. Preserve every claim and its meaning exactly; do not add new claims, citations, or data. Return only the improved passage.',
  questions:
    'Propose 6 focused research questions and 3 candidate hypotheses the author could investigate in the area described below. Frame them as open questions to pursue, never as findings. Group as "Research questions" and "Hypotheses".',
  keywords:
    'Suggest 8–12 indexing keywords and 2–3 subject classifications for the work below, ordered most to least central, to maximize discoverability. Return keywords as a comma-separated line, then classifications on a second line.',
  summary:
    'Write a 2–3 sentence plain-language summary of the work below for a non-specialist audience, preserving the author’s meaning and adding no new claims.',
};

const MIN_MATERIAL: Record<AssistantTask, number> = {
  abstract: 20,
  title: 20,
  improve: 30,
  questions: 8,
  keywords: 20,
  summary: 30,
};

const DISCLAIMER =
  'AI assistance — a drafting aid, not a source of facts. It never invents citations, data, or results; verify everything and insert real references before use.';

export interface AssistantResult {
  task: AssistantTask;
  text: string;
  /** Provider + model, e.g. `local` or `claude:claude-opus-5`. */
  model: string;
  providerName: string;
  /** True when produced by an external provider. */
  external: boolean;
  /** True when Claude was requested but no key was configured (used local). */
  fellBack: boolean;
  /** True when this is the deterministic on-platform scaffold, not full drafting. */
  offline: boolean;
  disclaimer: string;
}

const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'of', 'in', 'on', 'for', 'to', 'with', 'from', 'by', 'at',
  'as', 'is', 'are', 'was', 'were', 'be', 'been', 'this', 'that', 'these', 'those', 'its',
  'we', 'our', 'their', 'they', 'it', 'which', 'has', 'have', 'had', 'can', 'may', 'will',
  'study', 'studies', 'analysis', 'approach', 'using', 'used', 'toward', 'towards', 'via',
  'new', 'novel', 'review', 'paper', 'research', 'into', 'between', 'across', 'also', 'more',
  'results', 'result', 'method', 'methods', 'data', 'based', 'both', 'than', 'then', 'such',
]);

/** Deterministic keyword extraction from free text — no fabrication, offline-safe. */
export function extractKeywords(text: string, limit = 12): string[] {
  const counts = new Map<string, number>();
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w));
  for (const w of words) counts.set(w, (counts.get(w) ?? 0) + 1);
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([w]) => w);
}

function firstSentences(text: string, n: number): string {
  const parts = text.replace(/\s+/g, ' ').trim().match(/[^.!?]+[.!?]?/g) ?? [];
  return parts.slice(0, n).join(' ').trim();
}

/**
 * The on-platform scaffold when no external provider is configured. Genuinely
 * useful, entirely derived from the author's own text (no fabrication), and
 * honest that full drafting needs the external provider enabled.
 */
export function offlineAssist(task: AssistantTask, material: string): string {
  const m = material.trim();
  switch (task) {
    case 'keywords': {
      const kws = extractKeywords(m, 12);
      return kws.length
        ? `Suggested keywords (from your text):\n${kws.join(', ')}`
        : 'Add more descriptive text to extract keywords.';
    }
    case 'summary':
      return firstSentences(m, 2) || m;
    case 'title': {
      const kws = extractKeywords(m, 4);
      const lead = firstSentences(m, 1).replace(/[.!?]+$/, '');
      const lines = [
        'Title options are best generated with the full AI provider enabled. Working from your text:',
        `1. ${lead || m.slice(0, 80)}`,
      ];
      if (kws.length >= 2) lines.push(`2. ${kws.slice(0, 3).map(cap).join(', ')}: A Study`);
      return lines.join('\n');
    }
    case 'improve':
      return m; // never silently alter the author's meaning offline
    case 'abstract':
      return [
        'Abstract scaffold (fill each line from your key points):',
        'Background — ',
        'Aim — ',
        'Method — ',
        'Key result — [RESULT NEEDED]',
        'Conclusion — ',
        '',
        'Your key points:',
        m,
      ].join('\n');
    case 'questions': {
      const kws = extractKeywords(m, 3);
      const topic = kws.length ? kws.map(cap).join(', ') : 'this area';
      return [
        'Research questions to consider:',
        `1. What is the relationship between the key factors in ${topic}?`,
        `2. Under what conditions does the effect described hold or fail?`,
        `3. How do outcomes differ across populations or settings?`,
        '',
        '(Enable the full AI provider for tailored questions and hypotheses.)',
      ].join('\n');
    }
    default:
      return m;
  }
}

function cap(s: string): string {
  return s.length ? s[0]!.toUpperCase() + s.slice(1) : s;
}

async function authorFacts(researcherId: string, client: PrismaClient): Promise<GroundedFact[]> {
  const researcher = await client.researcher.findUnique({
    where: { id: researcherId },
    include: { interests: { orderBy: { label: 'asc' }, take: 12 } },
  });
  if (!researcher) throw notFound('Researcher not found');
  const facts: GroundedFact[] = [];
  if (researcher.interests.length > 0) {
    facts.push({
      ref: 'interests',
      kind: 'interest',
      text: `The author lists research interests: ${researcher.interests.map((i) => i.label).join(', ')}`,
    });
  }
  return facts;
}

function resolveProvider() {
  const env = loadServerEnv();
  const { provider, fellBack } = createAIProvider({
    provider: env.AI_PROVIDER,
    apiKey: env.AI_API_KEY,
    model: env.AI_MODEL,
    baseUrl: env.AI_BASE_URL,
  });
  return { provider, fellBack };
}

/**
 * Run one writing-assistant task over the author's own supplied material. When
 * an external provider is configured it produces full drafting; otherwise it
 * returns the deterministic on-platform scaffold. Never fabricates.
 */
export async function runAssistantTask(
  researcherId: string,
  input: { task: AssistantTask; material: string },
  client: PrismaClient = prisma,
): Promise<AssistantResult> {
  const task = input.task;
  if (!ASSISTANT_TASKS.includes(task)) throw badRequest('Unknown assistant task');
  const material = (input.material ?? '').trim();
  if (material.length < MIN_MATERIAL[task]) {
    throw badRequest(`Please provide a bit more detail (at least ${MIN_MATERIAL[task]} characters).`);
  }
  if (material.length > 8000) throw badRequest('Material is too long (max 8000 characters).');

  const facts = await authorFacts(researcherId, client);
  const { provider, fellBack } = resolveProvider();

  // No external provider → deterministic on-platform scaffold (still useful).
  if (!provider.external) {
    return {
      task,
      text: offlineAssist(task, material),
      model: 'local',
      providerName: 'local',
      external: false,
      fellBack,
      offline: true,
      disclaimer: DISCLAIMER,
    };
  }

  const ctx: GroundedContext = {
    task: `assist:${task}`,
    mode: 'assist',
    instruction: INSTRUCTIONS[task],
    facts,
    material,
    containsPrivate: false,
  };

  try {
    const generation = await provider.generateGrounded(ctx);
    return {
      task,
      text: generation.text,
      model: generation.model,
      providerName: provider.name,
      external: generation.external,
      fellBack,
      offline: false,
      disclaimer: DISCLAIMER,
    };
  } catch (err) {
    // Fail safe to the on-platform scaffold rather than erroring the user out.
    logger.warn({ err, task }, 'Assistant external provider failed; using on-platform scaffold');
    return {
      task,
      text: offlineAssist(task, material),
      model: 'local',
      providerName: 'local',
      external: false,
      fellBack,
      offline: true,
      disclaimer: DISCLAIMER,
    };
  }
}
