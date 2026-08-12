import Link from 'next/link';
import { Logo, Button } from '@researchtrics/ui';
import { getCurrentUser } from '@/lib/current-user';
import { LogoutButton } from './logout-button';

const NAV = [
  { href: '/discover', label: 'Discover' },
  { href: '/researchers', label: 'Researchers' },
  { href: '/publications', label: 'Publications' },
  { href: '/projects', label: 'Projects' },
  { href: '/institutions', label: 'Institutions' },
];

/** Global header — blue-forward, scholarly (Spec §80). */
export async function SiteHeader() {
  const user = await getCurrentUser();

  return (
    <header className="sticky top-0 z-40 border-b border-rt-border bg-rt-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-4">
        <div className="flex items-center gap-8">
          <Link href="/" aria-label="ResearchTrics home">
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
          {user ? (
            <>
              <Link
                href="/dashboard"
                className="text-sm font-medium text-rt-blue hover:underline"
              >
                Dashboard
              </Link>
              <LogoutButton />
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
