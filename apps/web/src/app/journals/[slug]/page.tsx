import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@researchtrics/db';
import { Card, Badge } from '@researchtrics/ui';

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const j = await prisma.journal.findUnique({ where: { slug } });
  if (!j) return { title: 'Journal' };
  const issn = j.issnElectronic ?? j.issnPrint;
  const description = `${j.name}${issn ? ` (ISSN ${issn})` : ''}${j.publisher ? `, published by ${j.publisher}` : ''} — publications indexed on ResearchTrics.`;
  const url = `${appUrl}/journals/${j.slug}`;
  return {
    title: j.name,
    description,
    alternates: { canonical: url },
    openGraph: { type: 'website', title: j.name, description, url, siteName: 'ResearchTrics', images: [{ url: '/logo.png' }] },
    twitter: { card: 'summary', title: j.name, description, images: ['/logo.png'] },
  };
}

export default async function JournalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const journal = await prisma.journal.findUnique({
    where: { slug },
    include: {
      publications: {
        where: { deletedAt: null, visibility: 'public' },
        orderBy: [{ publishedYear: 'desc' }],
        take: 100,
      },
    },
  });
  if (!journal) notFound();

  const issn = journal.issnElectronic ?? journal.issnPrint;
  const url = `${appUrl}/journals/${journal.slug}`;
  const periodicalJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Periodical',
    name: journal.name,
    ...(issn ? { issn } : {}),
    ...(journal.publisher ? { publisher: { '@type': 'Organization', name: journal.publisher } } : {}),
    url,
    mainEntityOfPage: url,
  };
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: appUrl },
      { '@type': 'ListItem', position: 2, name: 'Journals', item: `${appUrl}/journals` },
      { '@type': 'ListItem', position: 3, name: journal.name, item: url },
    ],
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(periodicalJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <h1 className="text-2xl font-semibold text-rt-text">{journal.name}</h1>
      <div className="mt-2 flex flex-wrap gap-2">
        {journal.issnElectronic || journal.issnPrint ? (
          <Badge variant="outline" className="font-mono">
            ISSN {journal.issnElectronic ?? journal.issnPrint}
          </Badge>
        ) : null}
        {journal.publisher ? <Badge variant="neutral">{journal.publisher}</Badge> : null}
      </div>

      <h2 className="mt-8 text-lg font-semibold text-rt-text">Publications</h2>
      {journal.publications.length === 0 ? (
        <p className="mt-3 text-rt-muted">No publications yet.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {journal.publications.map((p) => (
            <li key={p.id}>
              <Card className="p-4">
                <Link href={`/publications/${p.slug}`} className="font-medium text-rt-blue hover:underline">
                  {p.title}
                </Link>
                <p className="text-sm text-rt-muted">{p.publishedYear ?? ''}</p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
