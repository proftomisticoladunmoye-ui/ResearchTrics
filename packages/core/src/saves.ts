import { prisma, type PrismaClient } from '@researchtrics/db';
import { notFound } from './errors';

/**
 * Saving publications (§18) — a private bookmark so a researcher can read/track
 * a work later. No notification to the author; saves are the reader's own list.
 */

export interface SavedPublication {
  id: string;
  slug: string;
  title: string;
  year: number | null;
  venue: string | null;
  outputType: string;
  savedAt: Date;
}

export async function isPublicationSaved(
  researcherId: string,
  publicationId: string,
  client: PrismaClient = prisma,
): Promise<boolean> {
  if (!researcherId) return false;
  const row = await client.publicationSave.findUnique({
    where: { researcherId_publicationId: { researcherId, publicationId } },
    select: { id: true },
  });
  return !!row;
}

export async function savePublication(
  researcherId: string,
  publicationId: string,
  client: PrismaClient = prisma,
): Promise<{ saved: true }> {
  const pub = await client.publication.findFirst({
    where: { id: publicationId, deletedAt: null },
    select: { id: true },
  });
  if (!pub) throw notFound('Publication not found.');
  await client.publicationSave
    .create({ data: { researcherId, publicationId } })
    .catch(() => undefined); // idempotent (unique)
  return { saved: true };
}

export async function unsavePublication(
  researcherId: string,
  publicationId: string,
  client: PrismaClient = prisma,
): Promise<{ saved: false }> {
  await client.publicationSave
    .delete({ where: { researcherId_publicationId: { researcherId, publicationId } } })
    .catch(() => undefined);
  return { saved: false };
}

export async function listSavedPublications(
  researcherId: string,
  opts: { take?: number } = {},
  client: PrismaClient = prisma,
): Promise<SavedPublication[]> {
  const rows = await client.publicationSave.findMany({
    where: { researcherId, publication: { deletedAt: null } },
    include: { publication: { include: { journal: { select: { name: true } } } } },
    orderBy: { createdAt: 'desc' },
    take: opts.take ?? 100,
  });
  return rows.map((s) => ({
    id: s.publication.id,
    slug: s.publication.slug,
    title: s.publication.title,
    year: s.publication.publishedYear,
    venue: s.publication.journal?.name ?? null,
    outputType: s.publication.outputType,
    savedAt: s.createdAt,
  }));
}
