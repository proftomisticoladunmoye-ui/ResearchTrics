import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, Badge } from '@researchtrics/ui';
import { listAllCollections } from '@researchtrics/core';
import { requireAdmin } from '@/lib/admin';
import { CollectionCreate } from '@/components/collection-create';

export const metadata: Metadata = { title: 'Collections — Admin', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function AdminCollectionsPage() {
  await requireAdmin();
  const collections = await listAllCollections();

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-rt-text">Collections &amp; Series</h1>
          <p className="mt-1 text-sm text-rt-muted">Group bulletins into curated pathways. Collections are unordered; series are ordered.</p>
        </div>
        <Link href="/admin/research-bulletin" className="text-sm text-rt-blue hover:underline">← All bulletins</Link>
      </div>

      <div className="mt-6"><CollectionCreate /></div>

      <Card className="mt-6 p-0">
        {collections.length === 0 ? (
          <p className="p-6 text-sm text-rt-muted">No collections yet. Create one above.</p>
        ) : (
          <ul className="divide-y divide-rt-border">
            {collections.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-4 px-5 py-4">
                <div className="min-w-0">
                  <Link href={`/admin/research-bulletin/collections/${c.id}`} className="font-medium text-rt-blue hover:underline">{c.title}</Link>
                  <p className="text-xs text-rt-muted">{c.count} bulletin{c.count === 1 ? '' : 's'}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={c.kind === 'series' ? 'gold' : 'neutral'}>{c.kind}</Badge>
                  {c.published ? <Badge variant="success">Published</Badge> : <Badge variant="neutral">Hidden</Badge>}
                  <Link href={`/research-bulletin/collections/${c.slug}`} className="text-xs text-rt-muted hover:text-rt-blue">View</Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
