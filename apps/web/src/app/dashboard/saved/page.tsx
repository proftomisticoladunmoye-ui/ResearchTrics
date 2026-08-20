import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card, Badge } from '@researchtrics/ui';
import { listSavedPublications } from '@researchtrics/core';
import { getCurrentUser } from '@/lib/current-user';

export const metadata: Metadata = { title: 'Saved', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

function humanizeType(t: string): string {
  return t.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

export default async function SavedPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!user.researcher) redirect('/dashboard');

  const items = await listSavedPublications(user.researcher.id, { take: 100 });

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-2xl font-semibold text-rt-text">Saved</h1>
      <p className="mt-1 text-sm text-rt-muted">Publications you&rsquo;ve bookmarked to read or track.</p>

      {items.length === 0 ? (
        <Card className="mt-8 p-6">
          <p className="text-sm text-rt-text">Nothing saved yet.</p>
          <p className="mt-2 text-sm text-rt-muted">
            Use <strong>☆ Save</strong> on any publication to bookmark it here.
          </p>
        </Card>
      ) : (
        <ul className="mt-6 space-y-3">
          {items.map((it) => (
            <li key={it.id}>
              <Card className="flex items-start justify-between gap-3 p-5">
                <div className="min-w-0">
                  <Link href={`/publications/${it.slug}`} className="font-medium text-rt-blue hover:underline">
                    {it.title}
                  </Link>
                  <p className="mt-0.5 text-sm text-rt-muted">
                    {it.venue ?? humanizeType(it.outputType)}
                    {it.year ? ` · ${it.year}` : ''}
                  </p>
                </div>
                <Badge variant="neutral" className="shrink-0">{humanizeType(it.outputType)}</Badge>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
