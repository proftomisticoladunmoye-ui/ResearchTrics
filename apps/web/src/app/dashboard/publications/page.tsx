import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@researchtrics/db';
import { Card, Badge } from '@researchtrics/ui';
import { getCurrentUser } from '@/lib/current-user';
import { ImportDoiForm } from '@/components/import-doi-form';
import { AddPublicationForm } from '@/components/add-publication-form';

export const metadata: Metadata = {
  title: 'My publications',
  robots: { index: false, follow: false },
};

export default async function DashboardPublicationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!user.researcher) redirect('/dashboard');

  const authorships = await prisma.publicationAuthor.findMany({
    where: { researcherId: user.researcher.id, publication: { deletedAt: null } },
    include: { publication: { include: { journal: true } } },
    orderBy: { publication: { publishedYear: 'desc' } },
    take: 100,
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-2xl font-semibold text-rt-text">My publications</h1>

      <Card className="mt-6 p-6">
        <h2 className="text-base font-semibold text-rt-text">Import by DOI</h2>
        <p className="mt-1 text-xs text-rt-muted">
          For journal articles and anything with a DOI — metadata is fetched from Crossref.
        </p>
        <div className="mt-3">
          <ImportDoiForm />
        </div>
      </Card>

      <Card className="mt-6 p-6">
        <h2 className="text-base font-semibold text-rt-text">Add manually</h2>
        <p className="mt-1 text-xs text-rt-muted">
          For books, chapters, presentations, posters, theses, and reports — anything without a DOI.
          Optionally attach the file.
        </p>
        <div className="mt-3">
          <AddPublicationForm />
        </div>
      </Card>

      <section className="mt-8">
        <h2 className="text-base font-semibold text-rt-text">
          Linked to you ({authorships.length})
        </h2>
        {authorships.length === 0 ? (
          <p className="mt-3 text-rt-muted">
            No publications linked yet. Import by DOI above — if you are an author (matched by a
            verified ORCID iD), it links automatically.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {authorships.map((a) => (
              <li key={a.id}>
                <Card className="flex items-center justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <Link
                      href={`/publications/${a.publication.slug}`}
                      className="font-medium text-rt-blue hover:underline"
                    >
                      {a.publication.title}
                    </Link>
                    <p className="text-sm text-rt-muted">
                      {a.publication.journal?.name ?? ''}
                      {a.publication.publishedYear ? ` · ${a.publication.publishedYear}` : ''}
                    </p>
                  </div>
                  {a.matchConfidence === 1 ? (
                    <Badge variant="success">Claimed</Badge>
                  ) : (
                    <Badge variant="gold">Auto-linked</Badge>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
