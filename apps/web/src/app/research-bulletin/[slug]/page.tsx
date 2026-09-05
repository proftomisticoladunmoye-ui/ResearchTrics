import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getPublishedBulletinBySlug,
  incrementBulletinView,
  suggestedCitation,
  bulletinCitationData,
  listCitedBy,
  relatedBulletins,
  authorSlug,
  BULLETIN_TYPE_LABELS,
  LICENSE_LABELS,
  SERIES_NAME,
  SERIES_PUBLISHER,
  type BulletinAuthor,
  type BulletinReference,
  type BulletinListItem,
} from '@researchtrics/core';
import { Badge } from '@researchtrics/ui';
import { ShareButton } from '@/components/share-button';
import { BulletinCitations } from '@/components/bulletin-citations';

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.researchtrics.com';

function numberLabel(n: number | null): string {
  return n == null ? '' : String(n).padStart(3, '0');
}

/** A compact list of linked bulletins — used for "Cited by" and "Related". */
function BulletinRefList({ heading, items }: { heading: string; items: BulletinListItem[] }) {
  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold text-rt-text">{heading}</h2>
      <ul className="mt-3 space-y-2">
        {items.map((it) => (
          <li key={it.slug} className="text-sm">
            <Link href={`/research-bulletin/${it.slug}`} className="text-rt-blue hover:underline">
              {it.number != null ? `No. ${numberLabel(it.number)} · ` : ''}{it.title}
            </Link>
            <span className="text-rt-muted"> — {it.authors.map((a) => a.name).join(', ') || 'ResearchTrics'}{it.publicationDate ? `, ${it.publicationDate.getUTCFullYear()}` : ''}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const b = await getPublishedBulletinBySlug(slug);
  if (!b) return { title: 'Research Bulletin', robots: { index: false, follow: false } };

  const url = `${appUrl}/research-bulletin/${b.slug}`;
  const authors = (Array.isArray(b.authors) ? (b.authors as unknown as BulletinAuthor[]) : []).map((a) => a.name);
  const seriesTitle = b.number != null ? `${SERIES_NAME}, No. ${numberLabel(b.number)}` : SERIES_NAME;
  // Highwire citation_* tags for scholarly discovery (§5). No citation_pdf_url
  // until the PDF renderer ships (Phase 2) — a dead link would hurt indexing.
  const citation: Record<string, string | string[]> = {
    citation_title: b.title,
    citation_author: authors.length > 0 ? authors : [SERIES_PUBLISHER],
    citation_journal_title: seriesTitle,
    citation_publisher: SERIES_PUBLISHER,
  };
  if (b.publicationDate) citation.citation_publication_date = b.publicationDate.toISOString().slice(0, 10);
  if (b.keywords.length) citation.citation_keywords = b.keywords.join('; ');
  if (b.doi) citation.citation_doi = b.doi;
  // Full-text PDF for scholarly crawlers (§5) — now that the renderer exists.
  citation.citation_pdf_url = `${appUrl}/api/v1/research-bulletin/${b.slug}/pdf`;

  return {
    title: `${b.title} — ${SERIES_NAME}`,
    description: b.abstract.slice(0, 300),
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      title: b.title,
      description: b.abstract.slice(0, 300),
      url,
      siteName: 'ResearchTrics',
      ...(b.featuredImage ? { images: [{ url: b.featuredImage }] } : {}),
    },
    twitter: { card: b.featuredImage ? 'summary_large_image' : 'summary', title: b.title, description: b.abstract.slice(0, 200) },
    other: citation,
  };
}

export const revalidate = 300; // ISR: fast, cacheable public reads (§43)

export default async function BulletinPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const b = await getPublishedBulletinBySlug(slug);
  if (!b) notFound();

  void incrementBulletinView(b.id); // fire-and-forget

  const [citedBy, related] = await Promise.all([listCitedBy(b.id), relatedBulletins(b.id, 5)]);
  const authors = Array.isArray(b.authors) ? (b.authors as unknown as BulletinAuthor[]) : [];
  const references = Array.isArray(b.references) ? (b.references as unknown as BulletinReference[]) : [];
  const url = `${appUrl}/research-bulletin/${b.slug}`;
  const citation = suggestedCitation(b, appUrl);
  const cd = bulletinCitationData(b, appUrl);
  const year = b.publicationDate?.getUTCFullYear();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ScholarlyArticle',
    headline: b.title,
    ...(b.subtitle ? { alternativeHeadline: b.subtitle } : {}),
    abstract: b.abstract,
    ...(b.keywords.length ? { keywords: b.keywords.join(', ') } : {}),
    author: authors.map((a) => ({ '@type': 'Person', name: a.name, ...(a.affiliation ? { affiliation: a.affiliation } : {}) })),
    ...(b.publicationDate ? { datePublished: b.publicationDate.toISOString().slice(0, 10) } : {}),
    isPartOf: { '@type': 'PublicationIssue', name: SERIES_NAME, issueNumber: b.number ?? undefined },
    publisher: { '@type': 'Organization', name: SERIES_PUBLISHER },
    ...(b.doi ? { identifier: b.doi } : {}),
    url,
    mainEntityOfPage: url,
    inLanguage: 'en',
  };

  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav className="mb-4 text-xs text-rt-muted" aria-label="Breadcrumb">
        <Link href="/research-bulletin" className="hover:underline">Research Bulletin</Link>
        <span className="mx-1">/</span>
        <span>No. {numberLabel(b.number)}</span>
      </nav>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="gold" className="font-mono">{SERIES_NAME} · No. {numberLabel(b.number)}</Badge>
        <Badge variant="neutral">{BULLETIN_TYPE_LABELS[b.type]}</Badge>
        <Badge variant="outline">{b.category}</Badge>
      </div>

      <h1 className="mt-3 text-3xl font-semibold leading-tight text-rt-text">{b.title}</h1>
      {b.subtitle ? <p className="mt-2 text-lg text-rt-muted">{b.subtitle}</p> : null}

      {authors.length > 0 ? (
        <p className="mt-3 text-sm text-rt-text">
          {authors.map((a, i) => (
            <span key={i}>
              {i > 0 ? ', ' : ''}
              <Link href={`/research-bulletin/authors/${authorSlug(a.name)}`} className="text-rt-blue hover:underline">
                {a.name}
              </Link>
              {a.affiliation ? <span className="text-rt-muted"> ({a.affiliation})</span> : null}
            </span>
          ))}
        </p>
      ) : null}

      <p className="mt-1 text-sm text-rt-muted">
        {b.publicationDate ? b.publicationDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : ''}
        {' · '}Published by {SERIES_PUBLISHER}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <a
          href={`/api/v1/research-bulletin/${b.slug}/pdf`}
          className="inline-flex items-center gap-1.5 rounded-lg bg-rt-blue px-3 py-1.5 text-sm font-medium text-white hover:bg-rt-blue-dark"
        >
          ⬇ Download PDF
        </a>
        <ShareButton url={url} title={b.title} />
      </div>

      <section className="mt-8 rounded-lg border border-rt-border bg-rt-blue-light/20 p-5">
        <h2 className="text-base font-semibold text-rt-text">Abstract</h2>
        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-rt-text">{b.abstract}</p>
        {b.keywords.length ? (
          <p className="mt-3 text-xs text-rt-muted">
            <span className="font-semibold">Keywords:</span> {b.keywords.join(', ')}
          </p>
        ) : null}
      </section>

      {/* Body — sanitized on save, safe to render */}
      <div
        className="rt-bulletin-body mt-8 text-rt-text"
        dangerouslySetInnerHTML={{ __html: b.bodyHtml }}
      />

      {references.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-lg font-semibold text-rt-text">References</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-rt-text">
            {references.map((r, i) => (
              <li key={i}>
                {r.raw}
                {r.doi ? (
                  <>
                    {' '}
                    <a className="text-rt-blue hover:underline" href={`https://doi.org/${r.doi}`} target="_blank" rel="noopener noreferrer nofollow">
                      https://doi.org/{r.doi}
                    </a>
                  </>
                ) : null}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {citedBy.length > 0 ? <BulletinRefList heading="Cited by" items={citedBy} /> : null}
      {related.length > 0 ? <BulletinRefList heading="Related Research Bulletins" items={related} /> : null}

      <BulletinCitations slug={b.slug} suggested={citation} year={year} />

      <footer className="mt-10 border-t border-rt-border pt-4 text-xs text-rt-muted">
        <p>
          <span className="font-semibold">License:</span> {LICENSE_LABELS[b.license] ?? b.license}
        </p>
        <p className="mt-1">
          {SERIES_NAME} · No. {numberLabel(b.number)} · {SERIES_PUBLISHER}
          {cd.doi ? ` · https://doi.org/${cd.doi}` : ''}
        </p>
      </footer>
    </article>
  );
}
