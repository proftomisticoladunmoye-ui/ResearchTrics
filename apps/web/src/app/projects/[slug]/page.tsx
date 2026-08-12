import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getProjectBySlug } from '@researchtrics/core';
import { Card, Badge } from '@researchtrics/ui';

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProjectBySlug(slug);
  if (!p || p.visibility !== 'public') return { title: 'Project', robots: { index: false } };
  return {
    title: p.title,
    description: p.description?.slice(0, 200) ?? `${p.title} — ResearchTrics.`,
    alternates: { canonical: `${appUrl}/projects/${p.slug}` },
  };
}

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await getProjectBySlug(slug);
  if (!p) notFound();

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) =>
    children ? (
      <section className="mt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-rt-muted">{title}</h2>
        <div className="mt-1 whitespace-pre-line text-rt-text">{children}</div>
      </section>
    ) : null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="font-mono">{p.publicId}</Badge>
        <Badge variant="gold">{p.status}</Badge>
      </div>
      <h1 className="mt-3 text-3xl font-semibold text-rt-text">{p.title}</h1>
      <p className="mt-2 text-sm text-rt-muted">
        {p.pi?.displayName ? (
          <>
            PI:{' '}
            <Link href={`/researchers/${p.pi.slug}`} className="text-rt-blue hover:underline">
              {p.pi.displayName}
            </Link>
          </>
        ) : null}
        {p.institution?.name ? ` · ${p.institution.name}` : ''}
        {p.funder?.name ? ` · Funded by ${p.funder.name}` : ''}
      </p>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Section title="Description">{p.description}</Section>
          <Section title="Objectives">{p.objectives}</Section>
          <Section title="Research questions">{p.researchQuestions}</Section>
          <Section title="Methodology">{p.methodology}</Section>
        </div>

        <aside className="space-y-6">
          {p.members.length > 0 ? (
            <Card className="p-5">
              <h2 className="text-base font-semibold text-rt-text">Team</h2>
              <ul className="mt-3 space-y-1 text-sm">
                {p.members.map((m) => (
                  <li key={m.id}>
                    <Link href={`/researchers/${m.researcher.slug}`} className="text-rt-blue hover:underline">
                      {m.researcher.displayName}
                    </Link>
                    {m.role ? <span className="text-rt-muted"> — {m.role}</span> : null}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {p.datasets.length + p.instruments.length + p.software.length + p.publications.length > 0 ? (
            <Card className="p-5">
              <h2 className="text-base font-semibold text-rt-text">Outputs</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {p.publications.map((pp) => (
                  <li key={pp.publication.slug}>
                    <Link href={`/publications/${pp.publication.slug}`} className="text-rt-blue hover:underline">
                      {pp.publication.title}
                    </Link>
                  </li>
                ))}
                {p.datasets.map((d) => (
                  <li key={d.slug}>
                    <Link href={`/datasets/${d.slug}`} className="text-rt-blue hover:underline">
                      {d.title}
                    </Link>{' '}
                    <span className="text-rt-muted">· dataset ({d.accessLevel})</span>
                  </li>
                ))}
                {p.instruments.map((i) => (
                  <li key={i.slug}>
                    <Link href={`/instruments/${i.slug}`} className="text-rt-blue hover:underline">
                      {i.title}
                    </Link>{' '}
                    <span className="text-rt-muted">· instrument</span>
                  </li>
                ))}
                {p.software.map((s) => (
                  <li key={s.slug}>
                    <Link href={`/software/${s.slug}`} className="text-rt-blue hover:underline">
                      {s.name}
                    </Link>{' '}
                    <span className="text-rt-muted">· software</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
