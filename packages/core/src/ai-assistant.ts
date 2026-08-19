import { prisma, type PrismaClient } from '@researchtrics/db';
import { createAIProvider, LocalProvider, type GroundedContext, type GroundedFact } from '@researchtrics/ai';
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

export type AssistantTask =
  | 'abstract'
  | 'title'
  | 'improve'
  | 'proofread'
  | 'paraphrase'
  | 'questions'
  | 'keywords'
  | 'summary'
  | 'outline'
  | 'cover_letter'
  | 'reviewer_response'
  | 'refine';

export const ASSISTANT_TASKS: readonly AssistantTask[] = [
  'abstract',
  'title',
  'improve',
  'proofread',
  'paraphrase',
  'questions',
  'keywords',
  'summary',
  'outline',
  'cover_letter',
  'reviewer_response',
  'refine',
] as const;

const INSTRUCTIONS: Record<AssistantTask, string> = {
  abstract:
    'Draft a single structured abstract (background, aim, method, key result, conclusion) of 150–250 words from the author’s title and key points below. Where a specific statistic or result is implied but not given, insert [RESULT NEEDED]. Do not invent numbers or citations.',
  title:
    'Propose 5 clear, specific, publishable title options for the work described below. Vary emphasis (descriptive vs. finding-led). Return a numbered list only.',
  improve:
    'Rewrite the passage below in clear, concise, formal academic English, improving structure and flow. Preserve every claim and its meaning exactly; do not add new claims, citations, or data. Return only the improved passage.',
  proofread:
    'Correct grammar, spelling, punctuation, verb tense, articles, and word choice in the passage below. This author may be writing in English as a second language: fix errors and awkward phrasing but do NOT restructure sound sentences, change correct wording, or alter meaning. Preserve all technical terms. Return only the corrected passage.',
  paraphrase:
    'Rewrite the passage below using different wording and sentence structure while preserving its exact meaning and every claim. Improve clarity and flow. Do not add or remove information, citations, or data. Return only the rewritten passage.',
  questions:
    'Propose 6 focused research questions and 3 candidate hypotheses the author could investigate in the area described below. Frame them as open questions to pursue, never as findings. Group as "Research questions" and "Hypotheses".',
  keywords:
    'Suggest 8–12 indexing keywords and 2–3 subject classifications for the work below, ordered most to least central, to maximize discoverability. Return keywords as a comma-separated line, then classifications on a second line.',
  summary:
    'Write a 2–3 sentence plain-language summary of the work below for a non-specialist audience, preserving the author’s meaning and adding no new claims.',
  outline:
    'Produce a structured outline for a research paper on the work described below, following IMRaD (Introduction, Methods, Results, Discussion, and a brief Conclusion). Under each heading give 2–4 concise bullet points on what the author should cover. Do not invent findings — mark places for the author’s own results or data with [YOUR DATA]. Return the outline only.',
  cover_letter:
    'Draft a concise, professional cover letter to a journal editor for the manuscript described below. Include: one sentence on what the paper reports, why it matters and fits the journal, and a standard closing affirming the work is original and not under review elsewhere. Use placeholders [JOURNAL], [EDITOR], and [AUTHOR] where specifics are not given. Do not invent findings, metrics, or citations. Return only the letter.',
  reviewer_response:
    'Draft a courteous, point-by-point response to the reviewer comments below. For each comment: restate it briefly, then give a constructive, non-defensive response describing the change the author will make. Where the author’s intended change or supporting evidence is not provided, insert [DESCRIBE CHANGE] or [ADD EVIDENCE]. Do not invent results, numbers, or citations. Return the response only.',
  // `refine` is directive-driven — the instruction is composed at runtime from
  // the user's follow-up request (see runAssistantTask).
  refine:
    'Revise the passage below as instructed. Preserve all factual claims and meaning; add no new claims, citations, or data. Return only the revised text.',
};

const MIN_MATERIAL: Record<AssistantTask, number> = {
  abstract: 20,
  title: 20,
  improve: 30,
  proofread: 30,
  paraphrase: 30,
  questions: 8,
  keywords: 20,
  summary: 30,
  outline: 20,
  cover_letter: 20,
  reviewer_response: 30,
  refine: 10,
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
  /** When it fell back to on-platform, a short reason (env/key/provider issue). */
  diagnostic?: string;
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
    case 'proofread':
    case 'paraphrase':
    case 'refine':
      return m; // never silently alter the author's meaning offline
    case 'outline':
      return [
        'Paper outline (IMRaD scaffold — expand each point from your work):',
        'Introduction — background, gap, aim/contribution',
        'Methods — design, participants/data, procedure, analysis',
        'Results — [YOUR DATA]; key findings in order',
        'Discussion — interpretation, comparison to prior work, limitations',
        'Conclusion — takeaway and future work',
        '',
        'Your notes:',
        m,
      ].join('\n');
    case 'cover_letter':
      return [
        'Dear [EDITOR],',
        '',
        'Please consider our manuscript for publication in [JOURNAL].',
        '(One sentence on what the paper reports — from your notes below.)',
        '(One sentence on why it fits the journal and matters.)',
        '',
        'We confirm the work is original and not under consideration elsewhere.',
        '',
        'Sincerely,',
        '[AUTHOR]',
        '',
        'Your notes:',
        m,
      ].join('\n');
    case 'reviewer_response':
      return [
        'Response to reviewers (fill each response from your intended changes):',
        '',
        'Reviewer comment 1: (paste)',
        'Response: [DESCRIBE CHANGE]',
        '',
        '(Enable the full AI provider for a drafted point-by-point response.)',
        '',
        'Reviewer comments provided:',
        m,
      ].join('\n');
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
    include: {
      interests: { orderBy: { label: 'asc' }, take: 12 },
      affiliations: {
        where: { isPrimary: true },
        include: { institution: { select: { name: true } } },
        take: 1,
      },
    },
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
  const primary = researcher.affiliations[0]?.institution?.name;
  if (primary || researcher.academicRank) {
    facts.push({
      ref: 'author',
      kind: 'profile',
      text: `The author is ${researcher.academicRank ?? 'a researcher'}${primary ? ` at ${primary}` : ''} (use only if relevant, e.g. a cover-letter signature).`,
    });
  }
  return facts;
}

function resolveProvider(): { provider: ReturnType<typeof createAIProvider>['provider']; fellBack: boolean; note?: string } {
  // A malformed AI_* env var makes loadServerEnv throw. That must never 500 the
  // assistant — fall back to the on-platform provider (labelled, so the badge
  // shows "on-platform") instead of failing the request. `note` explains WHY we
  // fell back so the operator can fix the deployment without digging through logs.
  try {
    const env = loadServerEnv();
    const { provider, fellBack } = createAIProvider({
      provider: env.AI_PROVIDER,
      apiKey: env.AI_API_KEY,
      model: env.AI_MODEL,
      baseUrl: env.AI_BASE_URL,
    });
    // fellBack here means an external provider was requested but no AI_API_KEY.
    const note = fellBack
      ? `AI_PROVIDER=${env.AI_PROVIDER} but AI_API_KEY is missing/empty on this service`
      : undefined;
    return { provider, fellBack, note };
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'AI env invalid — using on-platform provider');
    return {
      provider: new LocalProvider(),
      fellBack: true,
      note: `AI env rejected: ${(err as Error).message.slice(0, 200)}`,
    };
  }
}

/**
 * Run one writing-assistant task over the author's own supplied material. When
 * an external provider is configured it produces full drafting; otherwise it
 * returns the deterministic on-platform scaffold. Never fabricates.
 */
export async function runAssistantTask(
  researcherId: string,
  input: { task: AssistantTask; material: string; directive?: string },
  client: PrismaClient = prisma,
): Promise<AssistantResult> {
  const task = input.task;
  if (!ASSISTANT_TASKS.includes(task)) throw badRequest('Unknown assistant task');
  const material = (input.material ?? '').trim();
  if (material.length < MIN_MATERIAL[task]) {
    throw badRequest(`Please provide a bit more detail (at least ${MIN_MATERIAL[task]} characters).`);
  }
  if (material.length > 8000) throw badRequest('Material is too long (max 8000 characters).');

  // `refine` composes its instruction from the user's follow-up directive.
  const directive = (input.directive ?? '').trim().slice(0, 300);
  if (task === 'refine' && directive.length < 2) {
    throw badRequest('Tell the assistant how to revise it (e.g. “make it shorter”).');
  }
  const instruction =
    task === 'refine'
      ? `Revise the passage below according to this instruction: "${directive}". Preserve all factual claims and meaning; add no new claims, citations, or data. Return only the revised text.`
      : INSTRUCTIONS[task];

  const facts = await authorFacts(researcherId, client);
  const { provider, fellBack, note } = resolveProvider();

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
      ...(note ? { diagnostic: note } : {}),
      disclaimer: DISCLAIMER,
    };
  }

  const ctx: GroundedContext = {
    task: `assist:${task}`,
    mode: 'assist',
    instruction,
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
      diagnostic: `provider call failed: ${(err as Error).message.slice(0, 200)}`,
      disclaimer: DISCLAIMER,
    };
  }
}
