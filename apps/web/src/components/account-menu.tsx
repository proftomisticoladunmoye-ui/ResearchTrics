'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Avatar, Badge } from '@researchtrics/ui';

/**
 * Account menu — the avatar dropdown in the header, grouping a researcher's own
 * destinations (public profile, their work, saved items, settings, sign out).
 * Inspired by the account menus of scholarly networks, adapted to ResearchTrics'
 * own features. CSS-only disclosure via <details> for open/close.
 */
export interface AccountMenuProps {
  displayName: string;
  slug: string;
  researchtricsId: string;
  photoUrl: string | null;
  email: string;
}

const LINKS: Array<{ href: string; label: string; hint?: string }> = [
  { href: '', label: 'View public profile', hint: 'How the world sees you' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/feed', label: 'Your feed', hint: 'Latest from who you follow' },
  { href: '/dashboard/publications', label: 'My publications', hint: 'Your research outputs' },
  { href: '/dashboard/saved', label: 'Saved', hint: 'Bookmarked publications' },
  { href: '/dashboard/assistant', label: 'AI Assistant', hint: 'Draft, refine, brainstorm' },
  { href: '/dashboard/rvm', label: 'Research Visibility Metric' },
  { href: '/dashboard/opportunities', label: 'Saved opportunities' },
  { href: '/dashboard/analytics', label: 'Analytics' },
  { href: '/dashboard/profile', label: 'Settings' },
];

export function AccountMenu({ displayName, slug, researchtricsId, photoUrl, email }: AccountMenuProps) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function onLogout() {
    setSigningOut(true);
    try {
      await fetch('/api/v1/auth/logout', { method: 'POST' });
      router.push('/');
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  }

  const profileHref = `/researchers/${slug}`;

  return (
    <details className="relative">
      <summary
        className="flex cursor-pointer list-none items-center rounded-full [&::-webkit-details-marker]:hidden"
        aria-label="Account menu"
      >
        <Avatar name={displayName} src={photoUrl ?? undefined} size="sm" className="ring-1 ring-rt-border" />
      </summary>

      <div className="absolute right-0 top-11 z-50 w-64 rounded-lg border border-rt-border bg-rt-white p-2 shadow-lg">
        <div className="flex items-center gap-3 border-b border-rt-border px-2 pb-3 pt-1">
          <Avatar name={displayName} src={photoUrl ?? undefined} size="md" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-rt-text">{displayName}</p>
            <p className="truncate text-xs text-rt-muted" title={email}>{email}</p>
            <Badge variant="gold" className="mt-1 font-mono text-[10px]">{researchtricsId}</Badge>
          </div>
        </div>

        <nav aria-label="Account" className="py-1">
          {LINKS.map((l) => (
            <Link
              key={l.label}
              href={l.href === '' ? profileHref : l.href}
              className="block rounded px-2 py-2 hover:bg-rt-blue-light"
            >
              <span className="block text-sm font-medium text-rt-text">{l.label}</span>
              {l.hint ? <span className="block text-xs text-rt-muted">{l.hint}</span> : null}
            </Link>
          ))}
        </nav>

        <div className="border-t border-rt-border pt-1">
          <button
            type="button"
            onClick={onLogout}
            disabled={signingOut}
            className="block w-full rounded px-2 py-2 text-left text-sm font-medium text-rt-error hover:bg-rt-error/5 disabled:opacity-60"
          >
            {signingOut ? 'Signing out…' : 'Log out'}
          </button>
        </div>
      </div>
    </details>
  );
}
