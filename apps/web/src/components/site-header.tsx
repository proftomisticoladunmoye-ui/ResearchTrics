import Link from 'next/link';
import { Logo, Button, Badge } from '@researchtrics/ui';
import { countUnreadNotifications } from '@researchtrics/core';
import { getCurrentUser } from '@/lib/current-user';
import { LogoutButton } from './logout-button';
import { AddNewMenu } from './add-new-menu';
import { AccountMenu } from './account-menu';

// Lean, purposeful nav. Browse-by-type (researchers, projects, institutions,
// journals, datasets…) all live inside Discover, so they are not repeated here;
// the header carries distinct destinations only. The logo is the "home" and
// leads to the general publications feed.
const NAV = [
  { href: '/discover', label: 'Discover' },
  { href: '/opportunities', label: 'Opportunities' },
  { href: '/dashboard/assistant', label: 'AI Assistant' },
];

/** Global header — blue-forward, scholarly (Spec §80). */
export async function SiteHeader() {
  const user = await getCurrentUser();
  const unread = user?.researcher ? await countUnreadNotifications(user.researcher.id) : 0;

  return (
    <header className="sticky top-0 z-40 border-b border-rt-border bg-rt-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-4">
        <div className="flex items-center gap-8">
          <Link href="/publications" aria-label="ResearchTrics — publications home">
            <Logo markSrc="/logo-mark.png" />
          </Link>
          <nav aria-label="Primary" className="hidden items-center gap-6 md:flex">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm font-medium text-rt-muted transition-colors hover:text-rt-blue"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {/* Mobile menu (CSS-only disclosure — no client JS) */}
          <details className="relative md:hidden">
            <summary
              className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded border border-rt-border text-lg text-rt-text [&::-webkit-details-marker]:hidden"
              aria-label="Open menu"
            >
              <span aria-hidden>☰</span>
            </summary>
            <nav
              aria-label="Mobile"
              className="absolute right-0 top-11 z-50 w-56 rounded border border-rt-border bg-rt-white p-2 shadow-lg"
            >
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block rounded px-3 py-2 text-sm text-rt-text hover:bg-rt-blue-light"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </details>

          {user ? (
            <>
              {user.researcher ? <AddNewMenu /> : null}
              {user.researcher ? (
                <Link
                  href="/notifications"
                  aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ''}`}
                  className="relative hidden text-rt-muted hover:text-rt-blue sm:inline-flex"
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.7 21a2 2 0 0 1-3.4 0" />
                  </svg>
                  {unread > 0 ? (
                    <span className="absolute -right-2 -top-2">
                      <Badge variant="error">{unread > 9 ? '9+' : unread}</Badge>
                    </span>
                  ) : null}
                </Link>
              ) : null}
              {user.researcher ? (
                <AccountMenu
                  displayName={user.researcher.displayName}
                  slug={user.researcher.slug}
                  researchtricsId={user.researcher.researchtricsId}
                  photoUrl={user.researcher.photoUrl}
                  email={user.email}
                />
              ) : (
                <>
                  <Link
                    href="/dashboard"
                    className="text-sm font-medium text-rt-blue hover:underline"
                  >
                    Dashboard
                  </Link>
                  <LogoutButton />
                </>
              )}
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/register">Create profile</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
