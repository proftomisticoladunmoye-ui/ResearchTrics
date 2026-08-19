import { type NextRequest } from 'next/server';
import { updateBlogPost, deleteBlogPost, isAdmin, unauthorized } from '@researchtrics/core';
import { ok, fail } from '@/lib/api';
import { getCurrentUser } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

/** Admin: update a blog post (§82). */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || !isAdmin(user.actor)) throw unauthorized();
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as {
      title?: string; excerpt?: string; body?: string; tone?: string; coverImage?: string; published?: boolean;
    };
    const post = await updateBlogPost(user.actor, id, {
      title: body.title ?? '',
      excerpt: body.excerpt ?? '',
      body: body.body ?? '',
      tone: body.tone,
      coverImage: body.coverImage ?? null,
      published: body.published,
    });
    return ok({ id: post.id, slug: post.slug, published: post.published });
  } catch (err) {
    return fail(err);
  }
}

/** Admin: delete a blog post. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || !isAdmin(user.actor)) throw unauthorized();
    const { id } = await params;
    await deleteBlogPost(user.actor, id);
    return ok({ deleted: true });
  } catch (err) {
    return fail(err);
  }
}
