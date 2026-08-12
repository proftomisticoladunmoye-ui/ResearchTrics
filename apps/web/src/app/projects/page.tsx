import type { Metadata } from 'next';
import Link from 'next/link';
import { listProjects } from '@researchtrics/core';
import { Card, Badge } from '@researchtrics/ui';

export const metadata: Metadata = {
  title: 'Research Projects',
  description: 'Browse research projects on ResearchTrics.',
};

export const dynamic = 'force-dynamic';

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const { items, total } = await listProjects({ query: q, take: 40 });

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-2xl font-semibold text-rt-text">Research Projects</h1>
      <p className="mt-1 text-sm text-rt-muted">{total} projects</p>
      {items.length === 0 ? (
        <p className="mt-8 text-rt-muted">No projects yet.</p>
      ) : (
        <ul className="mt-8 space-y-3">
          {items.map((p) => (
            <li key={p.id}>
              <Card className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link href={`/projects/${p.slug}`} className="font-semibold text-rt-blue hover:underline">
                      {p.title}
                    </Link>
                    <p className="mt-1 text-sm text-rt-muted">
                      {p.pi?.displayName ? `PI: ${p.pi.displayName}` : ''}
                      {p.institution?.name ? ` · ${p.institution.name}` : ''}
                    </p>
                  </div>
                  <Badge variant="outline">{p.status}</Badge>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
