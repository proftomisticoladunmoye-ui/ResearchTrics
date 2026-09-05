import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getBulletinAuthorProfile, SERIES_NAME } from '@researchtrics/core';
import { Card, Badge } from '@researchtrics/ui';

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.researchtrics.com';

export const revalidate = 300;

function num(n: number | null): string {
  return n == null ? '—' : String(n).padStart(3, '0');
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const profile = await getBulletinAuthorProfile(slug);
  if (!profile) return { title: 'Author', robots: { index: false, follow: false } };
  const url = `${appUrl}/research-bulletin/authors/${slug}`;
  return {
    title: `${profile.name} — ${SERIES_NAME}`,
    description: `Research Bulletins authored by ${profile.name} in the ${SERIES_NAME}.`,
    alternates: { canonical: url },
    openGraph: { type: 'profile', title: profile.name, url, siteName: 'ResearchTrics' },
  };
}

export default async function BulletinAuthorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = await getBulletinAuthorProfile(slug);
  if (!profile) notFound();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: profile.name,
    ...(profile.affiliation ? { affiliation: profile.affiliation } : {}),
    ...(profile.orcid ? { identifier: `https://orcid.org/${profile.orcid}` } : {}),
    url: `${appUrl}/research-bulletin/authors/${slug}`,
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <nav className="mb-4 text-xs text-rt-muted" aria-label="Breadcrumb">
        <Link href="/research-bulletin" className="hover:underline">Research Bulletin</Link>
        <span className="mx-1">/</span>
        <span>Authors</span>
      </nav>

      <h1 className="text-2xl font-semibold text-rt-text">{profile.name}</h1>
      {profile.affiliation ? <p className="mt-1 text-sm text-rt-muted">{profile.affiliation}</p> : null}
      {profile.orcid ? (
        <p className="mt-1 text-sm">
          <a className="text-rt-blue hover:underline" href={`https://orcid.org/${profile.orcid}`} target="_blank" rel="noopener noreferrer">
            ORCID: {profile.orcid}
          </a>
        </p>
      ) : null}
      <p className="mt-2 text-sm text-rt-muted">
        {profile.bulletins.length} bulletin{profile.bulletins.length === 1 ? '' : 's'} in the {SERIES_NAME}
      </p>

      <ul className="mt-6 space-y-3">
        {profile.bulletins.map((b) => (
          <li key={b.slug}>
            <Link href={`/research-bulletin/${b.slug}`} className="block">
              <Card className="p-4 transition hover:border-rt-blue">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="gold" className="font-mono text-xs">No. {num(b.number)}</Badge>
                  <span className="text-xs text-rt-muted">{b.category}</span>
                </div>
                <h2 className="mt-1 text-base font-semibold text-rt-text">{b.title}</h2>
                <p className="mt-1 line-clamp-2 text-sm text-rt-muted">{b.abstract}</p>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
