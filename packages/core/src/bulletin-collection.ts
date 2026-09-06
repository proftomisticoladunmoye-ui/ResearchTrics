import { prisma, type PrismaClient, type BulletinCollectionKind } from '@researchtrics/db';
import { slugWithSuffix } from './id';
import { badRequest, notFound } from './errors';
import type { BulletinListItem } from './bulletin';

/**
 * Research Bulletin collections & series (§53, §54): curated public groupings of
 * bulletins. A `collection` is thematic (unordered); a `series` is an ordered
 * research curriculum. Membership carries an order index used for series.
 */

export type { BulletinCollectionKind } from '@researchtrics/db';

export interface CollectionInput {
  title: string;
  description?: string | null;
  kind?: BulletinCollectionKind;
  published?: boolean;
}

// Local shaping mirrors bulletin.ts's toListItem to avoid a circular import.
function shape(b: {
  number: number | null; slug: string; title: string; subtitle: string | null;
  type: unknown; category: string; abstract: string; keywords: string[];
  featuredImage: string | null; publicationDate: Date | null; viewCount: number; downloadCount: number; authors: unknown;
}): BulletinListItem {
  return {
    number: b.number, slug: b.slug, title: b.title, subtitle: b.subtitle,
    type: b.type as BulletinListItem['type'], category: b.category, abstract: b.abstract,
    keywords: b.keywords, featuredImage: b.featuredImage, publicationDate: b.publicationDate,
    viewCount: b.viewCount, downloadCount: b.downloadCount,
    authors: Array.isArray(b.authors) ? (b.authors as BulletinListItem['authors']) : [],
  };
}

export async function createCollection(input: CollectionInput, client: PrismaClient = prisma): Promise<{ id: string; slug: string }> {
  const title = input.title?.trim();
  if (!title || title.length < 3) throw badRequest('A collection title of at least 3 characters is required.');
  const slug = slugWithSuffix(title, Math.random().toString(36).slice(2, 6));
  const c = await client.bulletinCollection.create({
    data: {
      slug, title,
      description: input.description?.trim() || null,
      kind: input.kind ?? 'collection',
      published: input.published ?? true,
    },
    select: { id: true, slug: true },
  });
  return c;
}

export async function updateCollection(id: string, input: Partial<CollectionInput>, client: PrismaClient = prisma): Promise<void> {
  const exists = await client.bulletinCollection.findUnique({ where: { id }, select: { id: true } });
  if (!exists) throw notFound('Collection not found.');
  await client.bulletinCollection.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
      ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
      ...(input.kind !== undefined ? { kind: input.kind } : {}),
      ...(input.published !== undefined ? { published: input.published } : {}),
    },
  });
}

export async function deleteCollection(id: string, client: PrismaClient = prisma): Promise<void> {
  await client.bulletinCollection.delete({ where: { id } }).catch(() => {
    throw notFound('Collection not found.');
  });
}

/** Replace a collection's membership with the given bulletins, in order. */
export async function setCollectionMembers(id: string, bulletinIds: string[], client: PrismaClient = prisma): Promise<void> {
  const collection = await client.bulletinCollection.findUnique({ where: { id }, select: { id: true } });
  if (!collection) throw notFound('Collection not found.');
  const ids = [...new Set(bulletinIds)].slice(0, 500);
  await client.$transaction([
    client.bulletinCollectionMember.deleteMany({ where: { collectionId: id } }),
    ...(ids.length
      ? [client.bulletinCollectionMember.createMany({ data: ids.map((bulletinId, i) => ({ collectionId: id, bulletinId, order: i })) })]
      : []),
  ]);
}

export interface CollectionSummary {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  kind: BulletinCollectionKind;
  published: boolean;
  count: number;
}

/** Public list of published collections (with published-member counts). */
export async function listCollections(client: PrismaClient = prisma): Promise<CollectionSummary[]> {
  const rows = await client.bulletinCollection.findMany({
    where: { published: true },
    orderBy: { title: 'asc' },
    include: { members: { where: { bulletin: { status: 'published' } }, select: { id: true } } },
  });
  return rows.map((c) => ({ id: c.id, slug: c.slug, title: c.title, description: c.description, kind: c.kind, published: c.published, count: c.members.length }));
}

/** Admin list of all collections. */
export async function listAllCollections(client: PrismaClient = prisma): Promise<CollectionSummary[]> {
  const rows = await client.bulletinCollection.findMany({
    orderBy: { updatedAt: 'desc' },
    include: { members: { select: { id: true } } },
  });
  return rows.map((c) => ({ id: c.id, slug: c.slug, title: c.title, description: c.description, kind: c.kind, published: c.published, count: c.members.length }));
}

export interface CollectionDetail extends CollectionSummary {
  bulletins: BulletinListItem[];
}

/** Public collection by slug with its published members in order. */
export async function getCollectionBySlug(slug: string, client: PrismaClient = prisma): Promise<CollectionDetail | null> {
  const c = await client.bulletinCollection.findFirst({
    where: { slug, published: true },
    include: {
      members: {
        where: { bulletin: { status: 'published' } },
        orderBy: { order: 'asc' },
        include: { bulletin: true },
      },
    },
  });
  if (!c) return null;
  return {
    id: c.id, slug: c.slug, title: c.title, description: c.description, kind: c.kind, published: c.published,
    count: c.members.length,
    bulletins: c.members.map((m) => shape(m.bulletin)),
  };
}

/** Admin: a collection with its current member ids (any status), for editing. */
export async function getCollectionForEdit(
  id: string,
  client: PrismaClient = prisma,
): Promise<{ id: string; title: string; description: string | null; kind: BulletinCollectionKind; published: boolean; members: Array<{ id: string; number: number | null; title: string; status: string }> } | null> {
  const c = await client.bulletinCollection.findUnique({
    where: { id },
    include: { members: { orderBy: { order: 'asc' }, include: { bulletin: { select: { id: true, number: true, title: true, status: true } } } } },
  });
  if (!c) return null;
  return {
    id: c.id, title: c.title, description: c.description, kind: c.kind, published: c.published,
    members: c.members.map((m) => ({ id: m.bulletin.id, number: m.bulletin.number, title: m.bulletin.title, status: m.bulletin.status })),
  };
}

/** Published collections a given bulletin belongs to — shown on the article ("Part of"). */
export async function getCollectionsForBulletin(bulletinId: string, client: PrismaClient = prisma): Promise<Array<{ slug: string; title: string; kind: BulletinCollectionKind }>> {
  const rows = await client.bulletinCollectionMember.findMany({
    where: { bulletinId, collection: { published: true } },
    include: { collection: { select: { slug: true, title: true, kind: true } } },
  });
  return rows.map((r) => ({ slug: r.collection.slug, title: r.collection.title, kind: r.collection.kind }));
}
