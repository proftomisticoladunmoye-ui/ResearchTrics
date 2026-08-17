import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPublicationBySlug, getEntityMetrics, CITATION_FORMATS, type CitationFormat } from '@researchtrics/core';
import { Card, Badge, DoiBadge, OpenAccessBadge, Button } from '@researchtrics/ui';
import { track } from '@/lib/track';

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

/**
 * A freely-downloadable full-text PDF URL for Google Scholar (§11): the legacy
 * `pdfUrl`, or the uploaded primary file served from the (Scholar-crawlable)
 * files route. Only PDFs qualify as full text.
 */
function pdfUrlFor(
  p: { pdfUrl: string | null; primaryFile: { storageKey: string; mimeType: string } | null },
  base: string,
): string | undefined {
  if (p.pdfUrl) return p.pdfUrl;
  if (p.primaryFile?.mimeType === 'application/pdf') {
    return `${base}/api/v1/files/${p.primaryFile.storageKey}`;
  }
  return undefined;
}

/**
 * Highwire `citation_*` meta + canonical (Spec §11, §42). Full Google Scholar
 * compliance checker + sitemaps arrive in Phase 5; the per-page metadata that
 * indexing depends on is emitted here.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const p = await getPublicationBySlug(slug);
  if (!p || p.visibility !== 'public') return { title: 'Publication', robots: { index: false } };

  const doi = p.identifiers.find((i) => i.scheme === 'doi')?.value;
  const url = `${appUrl}/publications/${p.slug}`;
  const citationMeta: Record<string, string | string[]> = {
    citation_title: p.title,
    citation_author: p.authors.map((a) => a.rawName),
  };
  if (p.journal?.name) citationMeta.citation_journal_title = p.journal.name;
  if (p.publishedOn) citationMeta.citation_publication_date = p.publishedOn.toISOString().slice(0, 10);
  else if (p.publishedYear) citationMeta.citation_publication_date = String(p.publishedYear);
  if (p.journal?.issnElectronic || p.journal?.issnPrint)
    citationMeta.citation_issn = (p.journal.issnElectronic ?? p.journal.issnPrint) as string;
  if (p.volume) citationMeta.citation_volume = p.volume;
  if (p.issue) citationMeta.citation_issue = p.issue;
  if (p.firstPage) citationMeta.citation_firstpage = p.firstPage;
  if (p.lastPage) citationMeta.citation_lastpage = p.lastPage;
  if (doi) citationMeta.citation_doi = doi;
  const pdfHref = pdfUrlFor(p, appUrl);
  if (pdfHref) citationMeta.citation_pdf_url = pdfHref;

  return {
    title: p.title,
    description: p.abstract ? p.abstract.slice(0, 200) : `${p.title} — ResearchTrics.`,
    alternates: { canonical: url },
    openGraph: { type: 'article', title: p.title, url },
    other: citationMeta,
  };
}

export default async function PublicationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const p = await getPublicationBySlug(slug);
  if (!p) notFound();

  await track('publication_view', 'publication', p.id);
  const metrics = await getEntityMetrics('publication', p.id);

  const doi = p.identifiers.find((i) => i.scheme === 'doi')?.value;

  const scholarlyJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ScholarlyArticle',
    headline: p.title,
    ...(p.abstract ? { abstract: p.abstract } : {}),
    author: p.authors.map((a) => ({ '@type': 'Person', name: a.rawName })),
    ...(p.journal?.name ? { isPartOf: { '@type': 'Periodical', name: p.journal.name } } : {}),
    ...(p.publishedOn ? { datePublished: p.publishedOn.toISOString().slice(0, 10) } : {}),
    ...(doi ? { identifier: `https://doi.org/${doi}`, sameAs: `https://doi.org/${doi}` } : {}),
    url: `${appUrl}/publications/${p.slug}`,
  };

  const formats = Object.entries(CITATION_FORMATS) as [CitationFormat, { label: string }][];

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(scholarlyJsonLd) }}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="font-mono">{p.publicId}</Badge>
        {p.openAccess ? <OpenAccessBadge /> : null}
        {doi ? <DoiBadge doi={doi} /> : null}
      </div>

      <h1 className="mt-3 text-3xl font-semibold leading-tight text-rt-text">{p.title}</h1>

      <p className="mt-3 text-rt-text">
        {p.authors.map((a, i) => (
          <span key={a.id}>
            {a.researcher ? (
              <Link href={`/researchers/${a.researcher.slug}`} className="text-rt-blue hover:underline">
                {a.rawName}
              </Link>
            ) : (
              a.rawName
            )}
            {i < p.authors.length - 1 ? ', ' : ''}
          </span>
        ))}
      </p>

      <p className="mt-2 text-sm text-rt-muted">
        {p.journal?.name ? <span className="font-medium text-rt-text">{p.journal.name}</span> : null}
        {p.volume ? ` ${p.volume}` : ''}
        {p.issue ? `(${p.issue})` : ''}
        {p.firstPage ? `: ${p.firstPage}${p.lastPage ? `–${p.lastPage}` : ''}` : ''}
        {p.publishedYear ? ` · ${p.publishedYear}` : ''}
        {p.publisher ? ` · ${p.publisher}` : ''}
      </p>

      <p className="mt-2 text-sm text-rt-muted" aria-label="Engagement (bot-filtered)">
        {(metrics.publication_view ?? 0).toLocaleString()} views ·{' '}
        {(metrics.download ?? 0).toLocaleString()} downloads
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        {doi ? (
          <Button asChild variant="secondary" size="sm">
            <a href={`https://doi.org/${doi}`} target="_blank" rel="noopener noreferrer">View at publisher</a>
          </Button>
        ) : null}
        {pdfUrlFor(p, appUrl) ? (
          <Button asChild size="sm">
            <a href={pdfUrlFor(p, appUrl)} target="_blank" rel="noopener noreferrer">PDF</a>
          </Button>
        ) : null}
      </div>

      {p.abstract ? (
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-rt-text">Abstract</h2>
          <p className="mt-2 whitespace-pre-line text-rt-text">{p.abstract}</p>
        </section>
      ) : null}

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        {/* Source-labelled citation counts — never merged (Spec §33) */}
        <Card className="p-5">
          <h2 className="text-base font-semibold text-rt-text">Citations by source</h2>
          {p.citationCounts.length === 0 ? (
            <p className="mt-2 text-sm text-rt-muted">No citation data yet.</p>
          ) : (
            <ul className="mt-3 space-y-1 text-sm">
              {p.citationCounts.map((c) => (
                <li key={c.id} className="flex justify-between">
                  <span className="capitalize text-rt-muted">{c.source}</span>
                  <span className="font-semibold tabular-nums text-rt-text">{c.count}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-rt-muted">
            Counts differ by provider and are shown separately, never combined.
          </p>
        </Card>

        {/* Citation export (Spec §10) */}
        <Card className="p-5">
          <h2 className="text-base font-semibold text-rt-text">Export citation</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {formats.map(([fmt, meta]) => (
              <Button key={fmt} asChild variant="secondary" size="sm">
                <a href={`/api/v1/publications/${p.slug}/cite?format=${fmt}`}>{meta.label}</a>
              </Button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
