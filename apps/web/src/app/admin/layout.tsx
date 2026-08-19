import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/admin';

export const metadata: Metadata = {
  title: 'Admin',
  robots: { index: false, follow: false },
};

const ADMIN_NAV = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/ojs', label: 'OJS Sync' },
  { href: '/admin/discovery', label: 'Discovery' },
  { href: '/admin/opportunities', label: 'Opportunities' },
  { href: '/admin/review', label: 'Review' },
  { href: '/admin/sources', label: 'Sources' },
  { href: '/admin/quality', label: 'Quality' },
  { href: '/admin/scholar', label: 'Scholar Check' },
  { href: '/admin/researchers', label: 'Researchers' },
  { href: '/admin/publications', label: 'Publications' },
  { href: '/admin/blog', label: 'Blog' },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  return (
    <div className="mx-auto max-w-7xl gap-8 px-4 py-10 md:grid md:grid-cols-[200px_1fr]">
      <aside className="mb-6 md:mb-0">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-rt-muted">
          Administration
        </p>
        <nav className="flex flex-col gap-1" aria-label="Admin">
          {ADMIN_NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="rounded px-3 py-2 text-sm text-rt-text hover:bg-rt-blue-light"
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div>{children}</div>
    </div>
  );
}
