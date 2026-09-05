import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getBulletinById, bulletinDoiProvider, type BulletinAuthor, type BulletinReference } from '@researchtrics/core';
import { requireAdmin } from '@/lib/admin';
import { BulletinEditor, type BulletinInitial } from '@/components/bulletin-editor';
import { MintBulletinDoi } from '@/components/mint-bulletin-doi';

export const metadata: Metadata = { title: 'Edit bulletin — Admin', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function EditBulletinPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const b = await getBulletinById(id);
  if (!b) notFound();
  const doiProvider = bulletinDoiProvider();

  const authors = (Array.isArray(b.authors) ? (b.authors as unknown as BulletinAuthor[]) : []).map((a) => ({
    name: a.name, affiliation: a.affiliation ?? '', orcid: a.orcid ?? '',
  }));
  const references = (Array.isArray(b.references) ? (b.references as unknown as BulletinReference[]) : []).map((r) => ({
    raw: r.raw, doi: r.doi ?? '',
  }));

  const initial: BulletinInitial = {
    id: b.id,
    number: b.number,
    slug: b.slug,
    status: b.status,
    title: b.title,
    subtitle: b.subtitle ?? '',
    type: b.type,
    category: b.category,
    abstract: b.abstract,
    keywords: b.keywords.join(', '),
    bodyHtml: b.bodyHtml,
    license: b.license,
    featuredImage: b.featuredImage ?? '',
    authors: authors.length ? authors : [{ name: '', affiliation: '', orcid: '' }],
    references,
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-2xl font-semibold text-rt-text">
        Edit bulletin{b.number != null ? ` · No. ${String(b.number).padStart(3, '0')}` : ''}
      </h1>
      <div className="mt-6">
        <BulletinEditor initial={initial} />
      </div>
      {b.status === 'published' && doiProvider ? (
        <MintBulletinDoi id={b.id} provider={doiProvider} existingDoi={b.doi} />
      ) : null}
    </div>
  );
}
