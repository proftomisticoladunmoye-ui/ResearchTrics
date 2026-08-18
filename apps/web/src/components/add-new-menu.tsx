import Link from 'next/link';

/**
 * "Add new" — one front door for contributing research, inspired by the
 * add-research panels of scholarly networks. Routes to the existing add flows
 * (import-by-DOI, manual publication with types, outputs, file upload). CSS-only
 * disclosure — no client JS.
 */
const GROUPS: Array<{ heading: string; items: Array<{ href: string; label: string; hint: string }> }> = [
  {
    heading: 'Publications',
    items: [
      { href: '/dashboard/publications', label: 'Import by DOI', hint: 'Fetch metadata from Crossref' },
      { href: '/dashboard/publications', label: 'Published research', hint: 'Article, book, chapter, thesis' },
      { href: '/dashboard/publications', label: 'Preprint / conference paper', hint: 'Preprint, proceedings, poster, talk' },
    ],
  },
  {
    heading: 'Other outputs',
    items: [
      { href: '/dashboard/outputs', label: 'Project / dataset / software', hint: 'Non-publication research outputs' },
      { href: '/dashboard/files', label: 'Upload a file', hint: 'PDF, dataset, image (up to 25 MB)' },
    ],
  },
];

export function AddNewMenu() {
  return (
    <details className="relative">
      <summary className="flex cursor-pointer list-none items-center gap-1 rounded bg-rt-blue px-3 py-1.5 text-sm font-medium text-rt-white [&::-webkit-details-marker]:hidden">
        <span className="text-base leading-none">+</span> Add
      </summary>
      <div className="absolute right-0 top-10 z-50 w-72 rounded-lg border border-rt-border bg-rt-white p-2 shadow-lg">
        {GROUPS.map((g) => (
          <div key={g.heading} className="py-1">
            <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-rt-muted">{g.heading}</p>
            {g.items.map((it) => (
              <Link key={it.label} href={it.href} className="block rounded px-3 py-2 hover:bg-rt-blue-light">
                <span className="block text-sm font-medium text-rt-text">{it.label}</span>
                <span className="block text-xs text-rt-muted">{it.hint}</span>
              </Link>
            ))}
          </div>
        ))}
      </div>
    </details>
  );
}
