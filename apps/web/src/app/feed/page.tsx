import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card, Badge } from '@researchtrics/ui';
import { getFollowingFeed } from '@researchtrics/core';
import { getCurrentUser } from '@/lib/current-user';

export const metadata: Metadata = { title: 'Your feed', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

function humanizeType(t: string): string {
  return t.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

export default async function FeedPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!user.researcher) redirect('/dashboard');

  const items = await getFollowingFeed(user.researcher.id, { take: 50 });

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-2xl font-semibold text-rt-text">Your feed</h1>
      <p className="mt-1 text-sm text-rt-muted">Recent work from the researchers you follow.</p>

      {items.length === 0 ? (
        <Card className="mt-8 p-6">
          <p className="text-sm text-rt-text">You&rsquo;re not following anyone yet.</p>
          <p className="mt-2 text-sm text-rt-muted">
            <Link href="/researchers" className="text-rt-blue hover:underline">Find researchers</Link>{' '}
            and follow them to see their latest publications here.
          </p>
        </Card>
      ) : (
        <ul className="mt-6 space-y-3">
          {items.map((it) => (
            <li key={it.id}>
              <Card className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/publications/${it.slug}`} className="font-medium text-rt-blue hover:underline">
                    {it.title}
                  </Link>
                  <Badge variant="neutral" className="shrink-0">{humanizeType(it.outputType)}</Badge>
                </div>
                <p className="mt-1 text-sm text-rt-muted">
                  {it.authors.slice(0, 4).join(', ')}
                  {it.authors.length > 4 ? ' et al.' : ''}
                </p>
                <p className="mt-0.5 text-sm text-rt-muted">
                  {it.venue ?? ''}
                  {it.year ? `${it.venue ? ' · ' : ''}${it.year}` : ''}
                </p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
