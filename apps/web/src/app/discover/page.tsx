import type { Metadata } from 'next';
import Link from 'next/link';
import {
  PostgresSearchIndex,
  parseSearchParams,
  SEARCHABLE_TYPES,
  type SearchableType,
} from '@researchtrics/search';
import { Card, Input, Button, Badge, Avatar } from '@researchtrics/ui';
import { DiscoverSidebar } from '@/components/discover-sidebar';

export const metadata: Metadata = {
  title: 'Discover Research',
  description: 'Search researchers, publications, institutions, and journals on ResearchTrics.',
};

export const dynamic = 'force-dynamic';

const index = new PostgresSearchIndex();

const TYPE_LABEL: Record<SearchableType, string> = {
  researcher: 'Researchers',
  publication: 'Publications',
  institution: 'Institutions',
  journal: 'Journals',
  project: 'Projects',
  dataset: 'Datasets',
  instrument: 'Instruments',
  software: 'Software',
};

const TYPE_BADGE: Record<SearchableType, string> = {
  researcher: 'Researcher',
  publication: 'Publication',
  institution: 'Institution',
  journal: 'Journal',
  project: 'Project',
  dataset: 'Dataset',
  instrument: 'Instrument',
  software: 'Software',
};

function toStr(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const flat: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(raw)) flat[k] = toStr(v);

  const query = parseSearchParams(flat);
  const result = await index.search(query);
  const activeType = query.filters?.types?.[0];

  const qsFor = (overrides: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    if (query.q) p.set('q', query.q);
    if (flat.yearFrom) p.set('yearFrom', flat.yearFrom);
    if (flat.yearTo) p.set('yearTo', flat.yearTo);
    if (flat.country) p.set('country', flat.country);
    if (flat.openAccess) p.set('openAccess', flat.openAccess);
    if (flat.verified) p.set('verified', flat.verified);
    for (const [k, v] of Object.entries(overrides)) {
      if (v === undefined) p.delete(k);
      else p.set(k, v);
    }
    return `/discover?${p.toString()}`;
  };

  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-2xl font-semibold text-rt-text">Discover Research</h1>

      <form className="mt-6 flex max-w-2xl gap-2" action="/discover" method="get">
        <Input
          name="q"
          defaultValue={query.q}
          placeholder="Search researchers, publications, institutions, journals…"
          aria-label="Search"
        />
        <Button type="submit">Search</Button>
        {/* preserve active filters on new search */}
        {activeType ? <input type="hidden" name="type" value={activeType} /> : null}
      </form>

      {/* Type facets */}
      <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="Result types">
        <Link
          href={qsFor({ type: undefined, page: undefined })}
          className={`rounded-full border px-3 py-1 text-sm ${
            !activeType ? 'border-rt-blue bg-rt-blue text-rt-white' : 'border-rt-border text-rt-muted hover:bg-rt-blue-light'
          }`}
        >
          All ({SEARCHABLE_TYPES.reduce((s, t) => s + result.facets.types[t], 0)})
        </Link>
        {SEARCHABLE_TYPES.map((t) => (
          <Link
            key={t}
            href={qsFor({ type: t, page: undefined })}
            className={`rounded-full border px-3 py-1 text-sm ${
              activeType === t ? 'border-rt-blue bg-rt-blue text-rt-white' : 'border-rt-border text-rt-muted hover:bg-rt-blue-light'
            }`}
          >
            {TYPE_LABEL[t]} ({result.facets.types[t]})
          </Link>
        ))}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_264px]">
        <section>
          <p className="text-sm text-rt-muted">{result.total} results</p>
          {result.items.length === 0 ? (
            <p className="mt-8 text-rt-muted">No results. Try a different search or filters.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {result.items.map((hit) => (
                <li key={`${hit.type}-${hit.id}`}>
                  <Card className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        {hit.type === 'researcher' ? (
                          <Avatar name={hit.title} src={hit.imageUrl ?? undefined} size="sm" />
                        ) : null}
                        <div className="min-w-0">
                          <Link href={hit.url} className="font-medium text-rt-blue hover:underline">
                            {hit.title}
                          </Link>
                          {hit.subtitle ? <p className="text-sm text-rt-muted">{hit.subtitle}</p> : null}
                        </div>
                      </div>
                      <Badge variant="outline">{TYPE_BADGE[hit.type]}</Badge>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}

          {totalPages > 1 ? (
            <nav className="mt-6 flex items-center gap-3 text-sm" aria-label="Pagination">
              {result.page > 1 ? (
                <Link className="text-rt-blue hover:underline" href={qsFor({ page: String(result.page - 1) })}>
                  Previous
                </Link>
              ) : null}
              <span className="text-rt-muted">Page {result.page} of {totalPages}</span>
              {result.page < totalPages ? (
                <Link className="text-rt-blue hover:underline" href={qsFor({ page: String(result.page + 1) })}>
                  Next
                </Link>
              ) : null}
            </nav>
          ) : null}
        </section>

        {/* Filters */}
        <aside>
          <Card className="p-4">
            <h2 className="text-sm font-semibold text-rt-text">Filters</h2>
            <form className="mt-3 flex flex-col gap-3 text-sm" action="/discover" method="get">
              <input type="hidden" name="q" value={query.q} />
              {activeType ? <input type="hidden" name="type" value={activeType} /> : null}
              <label className="flex flex-col gap-1">
                <span className="text-rt-muted">Year from</span>
                <Input name="yearFrom" type="number" defaultValue={flat.yearFrom ?? ''} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-rt-muted">Year to</span>
                <Input name="yearTo" type="number" defaultValue={flat.yearTo ?? ''} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-rt-muted">Country</span>
                <Input name="country" defaultValue={flat.country ?? ''} placeholder="e.g. KE" />
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="openAccess" value="true" defaultChecked={flat.openAccess === 'true'} />
                <span>Open access only</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="verified" value="true" defaultChecked={flat.verified === 'true'} />
                <span>Verified researchers</span>
              </label>
              <Button type="submit" variant="secondary" size="sm">
                Apply filters
              </Button>
            </form>
          </Card>

          <DiscoverSidebar />
        </aside>
      </div>
    </div>
  );
}
