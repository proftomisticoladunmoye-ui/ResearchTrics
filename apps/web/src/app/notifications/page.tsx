import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card } from '@researchtrics/ui';
import { listNotifications, markNotificationsRead } from '@researchtrics/core';
import { getCurrentUser } from '@/lib/current-user';

export const metadata: Metadata = {
  title: 'Notifications',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

function timeAgo(d: Date): string {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!user.researcher) redirect('/dashboard');

  const items = await listNotifications(user.researcher.id, { take: 100 });
  // Viewing the page marks everything read.
  await markNotificationsRead(user.researcher.id);

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold text-rt-text">Notifications</h1>
      <p className="mt-1 text-sm text-rt-muted">
        When your work is read, downloaded, or recommended — and roughly where from.
      </p>

      <Card className="mt-6 p-0">
        {items.length === 0 ? (
          <p className="p-6 text-sm text-rt-muted">
            No notifications yet. As people discover your work, activity shows up here.
          </p>
        ) : (
          <ul className="divide-y divide-rt-border">
            {items.map((n) => (
              <li key={n.id} className={`flex items-start gap-3 px-5 py-4 ${n.read ? '' : 'bg-rt-blue-light/40'}`}>
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? 'bg-transparent' : 'bg-rt-blue'}`}
                  aria-hidden
                />
                <div className="min-w-0">
                  <p className="text-sm text-rt-text">
                    {n.publicationSlug ? (
                      <Link href={`/publications/${n.publicationSlug}`} className="hover:underline">
                        {n.message}
                      </Link>
                    ) : (
                      n.message
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-rt-muted">{timeAgo(n.createdAt)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="mt-4 text-xs text-rt-muted">
        Location is country-level only — we never store or show a reader&rsquo;s identity or IP.
      </p>
    </div>
  );
}
