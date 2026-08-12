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
  return {
    title: inst.name,
    description: `${inst.name} on ResearchTrics.`,
    alternates: { canonical: `${appUrl}/institutions/${inst.slug}` },
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

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
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
                      <Avatar name={a.researcher.displayName} size="sm" />
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
