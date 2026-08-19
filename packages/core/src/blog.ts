import { prisma, type PrismaClient } from '@researchtrics/db';
import { isAdmin, type Actor } from './rbac';
import { badRequest, forbidden, notFound } from './errors';

/**
 * Blog service (§82). Public reads return only published posts; all writes are
 * gated on admin-console access. Posts are authored in the admin UI — body is
 * plain text with blank lines separating paragraphs.
 */

const TONES = new Set(['blue', 'gold', 'green', 'violet']);

export interface BlogPostView {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  tone: string;
  coverImage: string | null;
  published: boolean;
  publishedAt: Date | null;
  updatedAt: Date;
  authorName: string | null;
}

export interface BlogPostInput {
  title: string;
  excerpt: string;
  body: string;
  tone?: string;
  coverImage?: string | null;
  published?: boolean;
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'post'
  );
}

async function uniqueSlug(base: string, client: PrismaClient, excludeId?: string): Promise<string> {
  let slug = base;
  let n = 1;
  // Bounded loop — appends -2, -3, … until the slug is free.
  while (n < 500) {
    const existing = await client.blogPost.findUnique({ where: { slug }, select: { id: true } });
    if (!existing || existing.id === excludeId) return slug;
    n += 1;
    slug = `${base}-${n}`;
  }
  return `${base}-${Date.now()}`;
}

function normalize(input: BlogPostInput): {
  title: string;
  excerpt: string;
  body: string;
  tone: string;
  coverImage: string | null;
} {
  const title = input.title?.trim() ?? '';
  const excerpt = input.excerpt?.trim() ?? '';
  const body = input.body?.trim() ?? '';
  if (title.length < 3) throw badRequest('A title is required.');
  if (excerpt.length < 3) throw badRequest('A short excerpt is required.');
  if (body.length < 10) throw badRequest('The post body is too short.');
  const tone = input.tone && TONES.has(input.tone) ? input.tone : 'blue';
  const coverImage = input.coverImage?.trim() || null;
  return { title, excerpt, body, tone, coverImage };
}

function view(p: {
  id: string; slug: string; title: string; excerpt: string; body: string; tone: string;
  coverImage: string | null; published: boolean; publishedAt: Date | null; updatedAt: Date;
  author?: { email: string; researcher?: { displayName: string } | null } | null;
}): BlogPostView {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    excerpt: p.excerpt,
    body: p.body,
    tone: p.tone,
    coverImage: p.coverImage,
    published: p.published,
    publishedAt: p.publishedAt,
    updatedAt: p.updatedAt,
    authorName: p.author?.researcher?.displayName ?? null,
  };
}

const withAuthor = { author: { select: { email: true, researcher: { select: { displayName: true } } } } };

// ---------- Public reads ----------

export async function listPublishedBlogPosts(client: PrismaClient = prisma): Promise<BlogPostView[]> {
  const rows = await client.blogPost.findMany({
    where: { published: true },
    orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    include: withAuthor,
    take: 100,
  });
  return rows.map(view);
}

export async function getPublishedBlogPost(
  slug: string,
  client: PrismaClient = prisma,
): Promise<BlogPostView | null> {
  const p = await client.blogPost.findFirst({ where: { slug, published: true }, include: withAuthor });
  return p ? view(p) : null;
}

// ---------- Admin (gated) ----------

function assertAdmin(actor: Actor): void {
  if (!isAdmin(actor)) throw forbidden('Admin access is required.');
}

export async function listAllBlogPosts(actor: Actor, client: PrismaClient = prisma): Promise<BlogPostView[]> {
  assertAdmin(actor);
  const rows = await client.blogPost.findMany({
    orderBy: [{ updatedAt: 'desc' }],
    include: withAuthor,
    take: 200,
  });
  return rows.map(view);
}

export async function getBlogPostById(actor: Actor, id: string, client: PrismaClient = prisma): Promise<BlogPostView> {
  assertAdmin(actor);
  const p = await client.blogPost.findUnique({ where: { id }, include: withAuthor });
  if (!p) throw notFound('Post not found.');
  return view(p);
}

export async function createBlogPost(
  actor: Actor,
  input: BlogPostInput,
  client: PrismaClient = prisma,
): Promise<BlogPostView> {
  assertAdmin(actor);
  const n = normalize(input);
  const slug = await uniqueSlug(slugify(n.title), client);
  const published = input.published ?? false;
  const p = await client.blogPost.create({
    data: {
      ...n,
      slug,
      published,
      publishedAt: published ? new Date() : null,
      authorId: actor.userId,
    },
    include: withAuthor,
  });
  return view(p);
}

export async function updateBlogPost(
  actor: Actor,
  id: string,
  input: BlogPostInput,
  client: PrismaClient = prisma,
): Promise<BlogPostView> {
  assertAdmin(actor);
  const existing = await client.blogPost.findUnique({ where: { id }, select: { id: true, published: true, publishedAt: true } });
  if (!existing) throw notFound('Post not found.');
  const n = normalize(input);
  const published = input.published ?? existing.published;
  // Stamp publishedAt the first time it goes live; keep it thereafter.
  const publishedAt = published ? existing.publishedAt ?? new Date() : null;
  const p = await client.blogPost.update({
    where: { id },
    data: { ...n, published, publishedAt },
    include: withAuthor,
  });
  return view(p);
}

export async function deleteBlogPost(actor: Actor, id: string, client: PrismaClient = prisma): Promise<void> {
  assertAdmin(actor);
  await client.blogPost.delete({ where: { id } }).catch(() => {
    throw notFound('Post not found.');
  });
}

/** Convenience for a seed/bootstrap: create a published post if the slug is free. */
export async function ensureBlogPost(
  data: { slug: string; title: string; excerpt: string; body: string; tone: string },
  client: PrismaClient = prisma,
): Promise<boolean> {
  const existing = await client.blogPost.findUnique({ where: { slug: data.slug }, select: { id: true } });
  if (existing) return false;
  await client.blogPost.create({
    data: { ...data, published: true, publishedAt: new Date() },
  });
  return true;
}
