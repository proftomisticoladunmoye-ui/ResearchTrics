import type { Metadata } from 'next';
import Link from 'next/link';
import { listGroups } from '@researchtrics/core';
import { Card, Badge } from '@researchtrics/ui';

export const metadata: Metadata = {
  title: 'Research Groups',
  description: 'Browse research groups on ResearchTrics.',
};

export const dynamic = 'force-dynamic';

export default async function ResearchGroupsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const { items, total } = await listGroups({ query: q });

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-2xl font-semibold text-rt-text">Research Groups</h1>
      <p className="mt-1 text-sm text-rt-muted">{total} groups</p>
      {items.length === 0 ? (
        <p className="mt-8 text-rt-muted">No research groups yet.</p>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {items.map((g) => (
            <li key={g.id}>
              <Link href={`/research-groups/${g.slug}`}>
                <Card className="p-5 transition-colors hover:bg-rt-blue-light">
                  <p className="font-semibold text-rt-text">{g.name}</p>
                  <p className="mt-1 text-sm text-rt-muted">
                    {g.institution?.name ? `${g.institution.name} · ` : ''}
                    {g._count.members} member{g._count.members === 1 ? '' : 's'}
                  </p>
                  {g.interests ? (
                    <div className="mt-2">
                      <Badge variant="neutral">{g.interests.split(',')[0]?.trim()}</Badge>
                    </div>
                  ) : null}
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
