import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSoftwareBySlug } from '@researchtrics/core';
import { Badge, DoiBadge, Button } from '@researchtrics/ui';

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const s = await getSoftwareBySlug(slug);
  if (!s || s.visibility !== 'public') return { title: 'Software', robots: { index: false } };
  return {
    title: s.name,
    description: s.description?.slice(0, 200) ?? `${s.name} — research software on ResearchTrics.`,
    alternates: { canonical: `${appUrl}/software/${s.slug}` },
  };
}

export default async function SoftwarePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = await getSoftwareBySlug(slug);
  if (!s) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="font-mono">{s.publicId}</Badge>
        {s.version ? <Badge variant="neutral">v{s.version}</Badge> : null}
        {s.doi ? <DoiBadge doi={s.doi} /> : null}
      </div>
      <h1 className="mt-3 text-3xl font-semibold text-rt-text">{s.name}</h1>
      {s.author ? (
        <p className="mt-1 text-sm text-rt-muted">
          By{' '}
          <Link href={`/researchers/${s.author.slug}`} className="text-rt-blue hover:underline">
            {s.author.displayName}
          </Link>
        </p>
      ) : null}

      {s.description ? <p className="mt-5 whitespace-pre-line text-rt-text">{s.description}</p> : null}

      <div className="mt-6 flex flex-wrap gap-3">
        {s.repositoryUrl ? (
          <Button asChild size="sm">
            <a href={s.repositoryUrl} target="_blank" rel="noopener noreferrer">Repository</a>
          </Button>
        ) : null}
        {s.documentationUrl ? (
          <Button asChild size="sm" variant="secondary">
            <a href={s.documentationUrl} target="_blank" rel="noopener noreferrer">Documentation</a>
          </Button>
        ) : null}
      </div>

      {s.licenseCode ? <p className="mt-4 text-sm text-rt-muted">License: {s.licenseCode}</p> : null}
      {s.citationText ? (
        <p className="mt-2 text-sm text-rt-muted">
          <span className="font-medium text-rt-text">Cite as:</span> {s.citationText}
        </p>
      ) : null}
    </div>
  );
}
