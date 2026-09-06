import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCollectionForEdit } from '@researchtrics/core';
import { requireAdmin } from '@/lib/admin';
import { CollectionEditor, type CollectionInitial } from '@/components/collection-editor';

export const metadata: Metadata = { title: 'Edit collection — Admin', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function EditCollectionPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const c = await getCollectionForEdit(id);
  if (!c) notFound();

  const initial: CollectionInitial = {
    id: c.id,
    title: c.title,
    description: c.description ?? '',
    kind: c.kind,
    published: c.published,
    members: c.members,
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-2xl font-semibold text-rt-text">Edit {c.kind}</h1>
      <div className="mt-6">
        <CollectionEditor initial={initial} />
      </div>
    </div>
  );
}
