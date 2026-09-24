import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getInstitutionBySlug } from '@researchtrics/core';
import { Card, Avatar, Badge } from '@researchtrics/ui';

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const inst = await getInstitutionBySlug(slug);
  if (!inst) return { title: 'Institution' };
  const place = [inst.city, inst.country].filter(Boolean).join(', ');
  const description = `${inst.name}${place ? ` — ${place}` : ''}. Researchers and publications indexed on ResearchTrics.`;
  const url = `${appUrl}/institutions/${inst.slug}`;
  return {
    title: inst.name,
    description,
    alternates: { canonical: url },
    openGraph: { type: 'website', title: inst.name, description, url, siteName: 'ResearchTrics', images: [{ url: '/logo.png' }] },
    twitter: { card: 'summary', title: inst.name, description, images: ['/logo.png'] },
  };
}

export default async function InstitutionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const inst = await getInstitutionBySlug(slug);
  if (!inst) notFound();

  const url = `${appUrl}/institutions/${inst.slug}`;
  const sameAs = [
    ...(inst.rorId ? [`https://ror.org/${inst.rorId}`] : []),
    ...(inst.website ? [inst.website] : []),
  ];
  const orgJsonLd = {
    '@context': 'https://schema.org',
    '@type': inst.type === 'education' ? 'CollegeOrUniversity' : 'Organization',
    name: inst.name,
    ...(sameAs.length ? { sameAs } : {}),
    ...(inst.country || inst.city
      ? { address: { '@type': 'PostalAddress', ...(inst.city ? { addressLocality: inst.city } : {}), ...(inst.country ? { addressCountry: inst.country } : {}) } }
      : {}),
    url,
    mainEntityOfPage: url,
  };
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: appUrl },
      { '@type': 'ListItem', position: 2, name: 'Institutions', item: `${appUrl}/institutions` },
      { '@type': 'ListItem', position: 3, name: inst.name, item: url },
    ],
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-rt-text">{inst.name}</h1>
        {inst.rorId ? (
          <a href={`https://ror.org/${inst.rorId}`} target="_blank" rel="noopener noreferrer">
            <Badge variant="outline" className="font-mono">
              ROR {inst.rorId}
            </Badge>
          </a>
        ) : null}
      </div>
      <p className="mt-1 text-rt-muted">
        {[inst.city, inst.country].filter(Boolean).join(', ') || inst.type || 'Institution'}
      </p>

      {/* Grounded public counts (verified records only) */}
      <div className="mt-4 flex flex-wrap gap-2">
        <Badge variant="neutral">
          {inst.affiliations.length} public researcher{inst.affiliations.length === 1 ? '' : 's'}
        </Badge>
        {inst.departments.length > 0 ? (
          <Badge variant="neutral">
            {inst.departments.length} department{inst.departments.length === 1 ? '' : 's'}
          </Badge>
        ) : null}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <h2 className="text-lg font-semibold text-rt-text">Researchers</h2>
          {inst.affiliations.length === 0 ? (
            <p className="mt-3 text-rt-muted">No public researchers listed yet.</p>
          ) : (
            <ul className="mt-4 grid gap-4 sm:grid-cols-2">
              {inst.affiliations.map((a) => (
                <li key={a.id}>
                  <Link href={`/researchers/${a.researcher.slug}`}>
                    <Card className="flex items-center gap-3 p-4 transition-colors hover:bg-rt-blue-light">
                      <Avatar name={a.researcher.displayName} src={a.researcher.photoUrl ?? undefined} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-rt-text">
                          {a.researcher.displayName}
                        </p>
                        <p className="truncate text-sm text-rt-muted">
                          {a.researcher.academicRank ?? a.role}
                        </p>
                      </div>
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside>
          {inst.departments.length > 0 ? (
            <Card className="p-5">
              <h2 className="text-base font-semibold text-rt-text">Departments</h2>
              <ul className="mt-3 space-y-1 text-sm text-rt-muted">
                {inst.departments.map((d) => (
                  <li key={d.id}>{d.name}</li>
                ))}
              </ul>
            </Card>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
