/**
 * File-based blog (no database) — posts are authored here and ship with a
 * deploy. Kept simple and dependency-free: the body is an array of paragraphs,
 * and each post has a themed cover used as its display picture across the site.
 */

export type CoverTone = 'blue' | 'gold' | 'green' | 'violet';

export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  /** ISO date (YYYY-MM-DD). */
  date: string;
  author: string;
  tone: CoverTone;
  /** Optional real cover image in /public; falls back to the themed cover. */
  image?: string;
  body: string[];
}

/** Newest first. Add new posts to the top of this list. */
const POSTS: BlogPost[] = [
  {
    slug: 'make-your-research-visible',
    title: 'Make your research visible: a 15-minute setup',
    excerpt:
      'Claim your profile, import your publications, and switch on the metrics that help universities and funders find your work.',
    date: '2026-08-18',
    author: 'ResearchTrics Team',
    tone: 'blue',
    body: [
      'Visibility is not vanity — it is how collaborators, reviewers, funders, and students find the people doing the work that matters to them. On ResearchTrics, a complete profile is the single highest-leverage thing you can do for your research reach.',
      'Start by claiming your profile. If your work is already indexed in open scholarly sources, we may have discovered an unclaimed profile for you — claim it to take ownership, or create a new one in a minute.',
      'Next, import your publications. Paste a DOI and we fetch the metadata from Crossref; add books, chapters, theses, and presentations manually. Each output gets a clean, crawlable public page that Google and Google Scholar can index.',
      'Finally, add your interests and affiliation. These power discovery, opportunity matching, and the Research Visibility Metric — and they take about five minutes to fill in.',
    ],
  },
  {
    slug: 'opportunities-that-find-you',
    title: 'Opportunities that find you',
    excerpt:
      'Grants, fellowships, and positions matched to your field — delivered to your alerts and inbox, with the country they came from.',
    date: '2026-08-15',
    author: 'ResearchTrics Team',
    tone: 'gold',
    body: [
      'Hunting for funding and positions is a job in itself. ResearchTrics flips it around: we match open opportunities to the interests on your profile and bring them to you.',
      'When a new grant, fellowship, or position matches your work, it appears in your alerts and — if you opt in — a weekly email digest. Every match is explained, so you always know why it reached you.',
      'You can also post opportunities. If your lab, department, or organisation is hiring or funding, share it with a global research audience in a couple of clicks.',
    ],
  },
  {
    slug: 'grounded-ai-for-researchers',
    title: 'AI that never invents your citations',
    excerpt:
      'Our writing assistant drafts, tightens, and brainstorms from your own material — and refuses to fabricate data, results, or references.',
    date: '2026-08-12',
    author: 'ResearchTrics Team',
    tone: 'violet',
    body: [
      'AI is useful for scholarly writing only if you can trust it. The ResearchTrics assistant is built on one hard rule: it never fabricates evidence — no invented citations, statistics, results, or references. Where a fact is needed, it inserts a clear placeholder for you to fill in.',
      'It drafts abstracts from your key points, tightens dense paragraphs into clear academic English, proposes titles and keywords, and brainstorms research questions to pursue — always from the material you provide.',
      'Everything it produces is labelled AI-generated and framed as a starting point. You stay the author; it just helps you move faster.',
    ],
  },
];

export function getAllPosts(): BlogPost[] {
  return [...POSTS].sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function getPost(slug: string): BlogPost | undefined {
  return POSTS.find((p) => p.slug === slug);
}

/** Tailwind gradient classes for each cover tone (used as the display picture). */
export const COVER_GRADIENT: Record<CoverTone, string> = {
  blue: 'from-rt-blue to-rt-blue-dark',
  gold: 'from-rt-gold to-rt-blue',
  green: 'from-rt-success to-rt-blue',
  violet: 'from-[#6d5ae6] to-rt-blue',
};
