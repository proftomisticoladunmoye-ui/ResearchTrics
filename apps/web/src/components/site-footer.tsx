import Link from 'next/link';
import { Logo } from '@researchtrics/ui';

/** Footer (Spec §82). */
const COLUMNS: { heading: string; links: { href: string; label: string }[] }[] = [
  {
    heading: 'Discover',
    links: [
      { href: '/discover', label: 'Discover Research' },
      { href: '/researchers', label: 'Researchers' },
      { href: '/publications', label: 'Publications' },
      { href: '/institutions', label: 'Institutions' },
      { href: '/journals', label: 'Journals' },
      { href: '/research-groups', label: 'Research Groups' },
    ],
  },
  {
    heading: 'Platform',
    links: [
      { href: '/projects', label: 'Projects' },
      { href: '/opportunities', label: 'Research Opportunities' },
      { href: '/about', label: 'About' },
      { href: '/pricing', label: 'Pricing' },
      { href: '/blog', label: 'Blog' },
      { href: '/docs', label: 'Documentation' },
      { href: '/api', label: 'API' },
    ],
  },
  {
    heading: 'Trust',
    links: [
      { href: '/privacy', label: 'Privacy' },
      { href: '/terms', label: 'Terms' },
      { href: '/copyright', label: 'Copyright' },
      { href: '/contact', label: 'Contact' },
      { href: '/status', label: 'Status' },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-rt-border bg-rt-white">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-4 py-12 md:grid-cols-4">
        <div className="col-span-2 md:col-span-1">
          <Logo markSrc="/logo-mark.png" />
          <p className="mt-3 max-w-xs text-sm text-rt-muted">
            Make research visible, discoverable, connected, and measurable.
          </p>
        </div>
        {COLUMNS.map((col) => (
          <nav key={col.heading} aria-label={col.heading}>
            <h2 className="text-sm font-semibold text-rt-text">{col.heading}</h2>
            <ul className="mt-3 space-y-2">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-rt-muted hover:text-rt-blue">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-rt-border">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-4 text-xs text-rt-muted md:flex-row">
          <p>© {new Date().getFullYear()} ResearchTrics. All rights reserved.</p>
          <p>Research visibility infrastructure.</p>
        </div>
      </div>
    </footer>
  );
}
