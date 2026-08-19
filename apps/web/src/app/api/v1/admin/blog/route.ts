import { type NextRequest } from 'next/server';
import { createBlogPost, isAdmin, unauthorized } from '@researchtrics/core';
import { ok, fail } from '@/lib/api';
import { getCurrentUser } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

/** Admin: create a blog post (§82). */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !isAdmin(user.actor)) throw unauthorized();
    const body = (await req.json().catch(() => ({}))) as {
      title?: string; excerpt?: string; body?: string; tone?: string; coverImage?: string; published?: boolean;
    };
    const post = await createBlogPost(user.actor, {
      title: body.title ?? '',
      excerpt: body.excerpt ?? '',
      body: body.body ?? '',
      tone: body.tone,
      coverImage: body.coverImage ?? null,
      published: body.published ?? false,
    });
    return ok({ id: post.id, slug: post.slug });
  } catch (err) {
    return fail(err);
  }
}
