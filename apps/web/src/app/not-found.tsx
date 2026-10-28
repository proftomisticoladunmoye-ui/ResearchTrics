import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Page not found',
  robots: { index: false, follow: true },
};

const LINKS: { href: string; label: string }[] = [
  { href: '/discover', label: 'Discover research' },
  { href: '/researchers', label: 'Researchers' },
  { href: '/publications', label: 'Publications' },
  { href: '/research-bulletin', label: 'Research Bulletin' },
];

/**
 * Branded 404 (Next renders this with a real HTTP 404 status, so crawlers treat
 * it correctly — not a soft 404). Gives visitors a way back into the graph.
 */
export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-24 text-center">
      <p className="font-mono text-sm font-semibold text-rt-gold">404</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-rt-text">We couldn&rsquo;t find that page</h1>
      <p className="mt-3 text-rt-muted">
        The page may have moved, been removed, or never existed. Try searching, or head back to the homepage.
      </p>

      <form action="/discover" method="get" className="mx-auto mt-8 flex max-w-md gap-2">
        <input
          name="q"
          placeholder="Search researchers, publications, journals…"
          aria-label="Search ResearchTrics"
          className="w-full rounded-lg border border-rt-border bg-rt-white px-3 py-2 text-sm text-rt-text"
        />
        <button type="submit" className="rounded-lg bg-rt-blue px-4 py-2 text-sm font-medium text-white">
          Search
        </button>
      </form>

      <div className="mt-8 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm">
        <Link href="/" className="font-medium text-rt-blue hover:underline">Home</Link>
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="text-rt-muted hover:text-rt-blue">
            {l.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
