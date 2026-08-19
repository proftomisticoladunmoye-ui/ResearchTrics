/**
 * One-off: grant platform_admin to the owner account and seed starter blog posts.
 * Idempotent — safe to re-run. Reads DATABASE_URL from the environment.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Grant to a specific email, else the sole account on this domain (the owner's
// Kampala International University login).
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? '';
const ADMIN_DOMAIN = process.env.ADMIN_DOMAIN ?? '@kiu.ac.ug';

const STARTER_POSTS = [
  {
    slug: 'make-your-research-visible',
    title: 'Make your research visible: a 15-minute setup',
    excerpt:
      'Claim your profile, import your publications, and switch on the metrics that help universities and funders find your work.',
    tone: 'blue',
    body: [
      'Visibility is not vanity — it is how collaborators, reviewers, funders, and students find the people doing the work that matters to them. On ResearchTrics, a complete profile is the single highest-leverage thing you can do for your research reach.',
      'Start by claiming your profile. If your work is already indexed in open scholarly sources, we may have discovered an unclaimed profile for you — claim it to take ownership, or create a new one in a minute.',
      'Next, import your publications. Paste a DOI and we fetch the metadata from Crossref; add books, chapters, theses, and presentations manually. Each output gets a clean, crawlable public page that Google and Google Scholar can index.',
      'Finally, add your interests and affiliation. These power discovery, opportunity matching, and the Research Visibility Metric — and they take about five minutes to fill in.',
    ].join('\n\n'),
  },
  {
    slug: 'opportunities-that-find-you',
    title: 'Opportunities that find you',
    excerpt:
      'Grants, fellowships, and positions matched to your field — delivered to your alerts and inbox, with the country they came from.',
    tone: 'gold',
    body: [
      'Hunting for funding and positions is a job in itself. ResearchTrics flips it around: we match open opportunities to the interests on your profile and bring them to you.',
      'When a new grant, fellowship, or position matches your work, it appears in your alerts and — if you opt in — a weekly email digest. Every match is explained, so you always know why it reached you.',
      'You can also post opportunities. If your lab, department, or organisation is hiring or funding, share it with a global research audience in a couple of clicks.',
    ].join('\n\n'),
  },
  {
    slug: 'grounded-ai-for-researchers',
    title: 'AI that never invents your citations',
    excerpt:
      'Our writing assistant drafts, tightens, and brainstorms from your own material — and refuses to fabricate data, results, or references.',
    tone: 'violet',
    body: [
      'AI is useful for scholarly writing only if you can trust it. The ResearchTrics assistant is built on one hard rule: it never fabricates evidence — no invented citations, statistics, results, or references. Where a fact is needed, it inserts a clear placeholder for you to fill in.',
      'It drafts abstracts from your key points, tightens dense paragraphs into clear academic English, proposes titles and keywords, and brainstorms research questions to pursue — always from the material you provide.',
      'Everything it produces is labelled AI-generated and framed as a starting point. You stay the author; it just helps you move faster.',
    ].join('\n\n'),
  },
];

async function main() {
  const user = ADMIN_EMAIL
    ? await prisma.user.findUnique({ where: { email: ADMIN_EMAIL }, select: { id: true, email: true } })
    : await prisma.user.findFirst({ where: { email: { endsWith: ADMIN_DOMAIN } }, select: { id: true, email: true } });
  if (!user) {
    console.error(`No matching account (${ADMIN_EMAIL || ADMIN_DOMAIN}). Register/log in first, then re-run.`);
    process.exit(1);
  }
  const label = user.email.replace(/^(.{3}).*(@.*)$/, '$1***$2');
  console.log(`Target account: ${label}`);

  // findFirst + create (not upsert): scopeId is a nullable part of the unique,
  // and Postgres treats NULLs as distinct, which breaks upsert matching.
  const existingRole = await prisma.userRole.findFirst({
    where: { userId: user.id, role: 'platform_admin', scopeType: 'global', scopeId: null },
    select: { id: true },
  });
  if (existingRole) {
    console.log(`${ADMIN_EMAIL} already has platform_admin (role id ${existingRole.id}).`);
  } else {
    const role = await prisma.userRole.create({
      data: { userId: user.id, role: 'platform_admin', scopeType: 'global', scopeId: null },
    });
    console.log(`Granted platform_admin to ${ADMIN_EMAIL} (role id ${role.id}).`);
  }

  let created = 0;
  for (const p of STARTER_POSTS) {
    const exists = await prisma.blogPost.findUnique({ where: { slug: p.slug }, select: { id: true } });
    if (exists) continue;
    await prisma.blogPost.create({
      data: { ...p, published: true, publishedAt: new Date(), authorId: user.id },
    });
    created += 1;
  }
  console.log(`Seeded ${created} blog post(s) (existing ones skipped).`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
