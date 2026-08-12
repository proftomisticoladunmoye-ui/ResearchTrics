import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getInstrumentBySlug } from '@researchtrics/core';
import { Card, Badge, DoiBadge } from '@researchtrics/ui';

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const i = await getInstrumentBySlug(slug);
  if (!i || i.visibility !== 'public') return { title: 'Instrument', robots: { index: false } };
  return {
    title: i.title,
    description: i.construct ? `${i.title} — measures ${i.construct}.` : i.title,
    alternates: { canonical: `${appUrl}/instruments/${i.slug}` },
  };
}

export default async function InstrumentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const i = await getInstrumentBySlug(slug);
  if (!i) notFound();

  const Row = ({ label, value }: { label: string; value?: string | number | null }) =>
    value ? (
      <div className="grid grid-cols-3 gap-2 py-1.5 text-sm">
        <dt className="text-rt-muted">{label}</dt>
        <dd className="col-span-2 text-rt-text">{value}</dd>
      </div>
    ) : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="font-mono">{i.publicId}</Badge>
        {i.doi ? <DoiBadge doi={i.doi} /> : null}
      </div>
      <h1 className="mt-3 text-3xl font-semibold text-rt-text">{i.title}</h1>
      {i.author ? (
        <p className="mt-1 text-sm text-rt-muted">
          By{' '}
          <Link href={`/researchers/${i.author.slug}`} className="text-rt-blue hover:underline">
            {i.author.displayName}
          </Link>
        </p>
      ) : null}

      <Card className="mt-6 p-5">
        <h2 className="text-base font-semibold text-rt-text">Psychometric metadata</h2>
        <dl className="mt-3">
          <Row label="Construct" value={i.construct} />
          <Row label="Population" value={i.population} />
          <Row label="Language" value={i.language} />
          <Row label="Country" value={i.country} />
          <Row label="Items" value={i.itemCount} />
          <Row label="Response scale" value={i.responseScale} />
          <Row label="Scoring" value={i.scoringMethod} />
          <Row label="Reliability" value={i.reliability} />
          <Row label="Validity evidence" value={i.validityEvidence} />
          <Row label="Factor structure" value={i.factorStructure} />
          <Row label="Norms" value={i.norms} />
          <Row label="Copyright" value={i.copyright} />
          <Row label="License" value={i.licenseCode} />
          {i.dataset ? <Row label="Related dataset" value={i.dataset.title} /> : null}
          {i.project ? <Row label="Project" value={i.project.title} /> : null}
        </dl>
      </Card>
    </div>
  );
}
