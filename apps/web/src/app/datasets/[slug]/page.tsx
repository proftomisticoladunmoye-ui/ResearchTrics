import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDatasetBySlug } from '@researchtrics/core';
import { Card, Badge, Alert, DoiBadge } from '@researchtrics/ui';

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const d = await getDatasetBySlug(slug);
  if (!d || d.visibility !== 'public') return { title: 'Dataset', robots: { index: false } };
  return {
    title: d.title,
    description: d.description?.slice(0, 200) ?? `${d.title} — dataset on ResearchTrics.`,
    alternates: { canonical: `${appUrl}/datasets/${d.slug}` },
  };
}

export default async function DatasetPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const d = await getDatasetBySlug(slug);
  if (!d) notFound();

  const restricted = d.accessLevel !== 'open';
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: d.title,
    ...(d.description ? { description: d.description } : {}),
    ...(d.doi ? { identifier: `https://doi.org/${d.doi}` } : {}),
    ...(d.creator ? { creator: { '@type': 'Person', name: d.creator.displayName } } : {}),
    url: `${appUrl}/datasets/${d.slug}`,
  };

  const Row = ({ label, value }: { label: string; value?: string | number | null }) =>
    value ? (
      <div className="grid grid-cols-3 gap-2 py-1.5 text-sm">
        <dt className="text-rt-muted">{label}</dt>
        <dd className="col-span-2 text-rt-text">{value}</dd>
      </div>
    ) : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="font-mono">{d.publicId}</Badge>
        <Badge variant={d.accessLevel === 'open' ? 'success' : 'warning'}>{d.accessLevel}</Badge>
        {d.doi ? <DoiBadge doi={d.doi} /> : null}
      </div>
      <h1 className="mt-3 text-3xl font-semibold text-rt-text">{d.title}</h1>
      {d.creator ? (
        <p className="mt-1 text-sm text-rt-muted">
          Created by{' '}
          <Link href={`/researchers/${d.creator.slug}`} className="text-rt-blue hover:underline">
            {d.creator.displayName}
          </Link>
        </p>
      ) : null}

      {d.description ? <p className="mt-5 whitespace-pre-line text-rt-text">{d.description}</p> : null}

      {restricted ? (
        <div className="mt-5">
          <Alert variant="warning" title="Access restricted">
            This dataset&apos;s access level is &quot;{d.accessLevel}&quot;. Contact the creator or
            institution for access; restricted data is not distributed through this page.
          </Alert>
        </div>
      ) : null}

      <Card className="mt-6 p-5">
        <dl>
          <Row label="Sample" value={d.sample} />
          <Row label="Geography" value={d.geography} />
          <Row label="Methodology" value={d.methodology} />
          <Row label="Variables" value={d.variablesText} />
          <Row label="File formats" value={d.fileFormats} />
          <Row label="License" value={d.licenseCode} />
          <Row label="Version" value={d.version} />
          <Row label="Ethics" value={d.ethicsInfo} />
          {d.project ? <Row label="Project" value={d.project.title} /> : null}
        </dl>
      </Card>
      {d.citationText ? (
        <p className="mt-4 text-sm text-rt-muted">
          <span className="font-medium text-rt-text">Cite as:</span> {d.citationText}
        </p>
      ) : null}
    </div>
  );
}
