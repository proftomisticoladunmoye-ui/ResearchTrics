import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getOpportunityBySlug } from '@researchtrics/core';
import { prisma } from '@researchtrics/db';
import { Card, Badge, Button } from '@researchtrics/ui';
import { getCurrentUser } from '@/lib/current-user';
import { OpportunitySaveButton } from '@/components/opportunity-save-button';
import { TYPE_LABELS } from '@/lib/opportunity-labels';

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const o = await getOpportunityBySlug(slug);
  if (!o) return { title: 'Opportunity' };
  return {
    title: o.title,
    description: o.summary ?? `${TYPE_LABELS[o.type]} on ResearchTrics.`,
    alternates: { canonical: `${appUrl}/opportunities/${o.slug}` },
  };
}

export const dynamic = 'force-dynamic';

export default async function OpportunityDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const o = await getOpportunityBySlug(slug);
  if (!o) notFound();

  const user = await getCurrentUser();
  const saved =
    user?.researcher != null
      ? (await prisma.opportunitySave.findUnique({
          where: { opportunityId_researcherId: { opportunityId: o.id, researcherId: user.researcher.id } },
          select: { id: true },
        })) != null
      : false;

  const closed = o.status !== 'open' || (o.deadline != null && o.deadline.getTime() < Date.now());

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <Link href="/opportunities" className="text-sm text-rt-blue hover:underline">
        ← All opportunities
      </Link>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Badge variant="neutral">{TYPE_LABELS[o.type]}</Badge>
        <Badge variant="outline" className="font-mono">
          {o.publicId}
        </Badge>
        {closed ? <Badge variant="warning">Closed</Badge> : <Badge variant="success">Open</Badge>}
      </div>

      <h1 className="mt-3 text-2xl font-semibold text-rt-text">{o.title}</h1>
      <p className="mt-1 text-rt-muted">
        {[o.organization, o.funder?.name, o.country].filter(Boolean).join(' · ') || 'Research opportunity'}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {o.url ? (
          <Button asChild size="sm">
            <a href={o.url} target="_blank" rel="noopener noreferrer">
              Apply / read more ↗
            </a>
          </Button>
        ) : null}
        {user?.researcher ? (
          <OpportunitySaveButton opportunityId={o.id} initialSaved={saved} />
        ) : null}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-rt-muted">Deadline</p>
          <p className="mt-1 text-sm font-medium text-rt-text">
            {o.deadline
              ? o.deadline.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
              : 'No deadline'}
          </p>
        </Card>
        {o.amountMin != null || o.amountMax != null ? (
          <Card className="p-4">
            <p className="text-xs text-rt-muted">Funding</p>
            <p className="mt-1 text-sm font-medium text-rt-text">
              {o.currency ?? ''} {o.amountMin?.toString() ?? ''}
              {o.amountMax != null ? `–${o.amountMax.toString()}` : ''}
            </p>
          </Card>
        ) : null}
        {o.institution ? (
          <Card className="p-4">
            <p className="text-xs text-rt-muted">Institution</p>
            <Link
              href={`/institutions/${o.institution.slug}`}
              className="mt-1 block text-sm font-medium text-rt-blue hover:underline"
            >
              {o.institution.name}
            </Link>
          </Card>
        ) : null}
      </div>

      {o.summary ? <p className="mt-6 text-rt-text">{o.summary}</p> : null}
      {o.description ? (
        <div className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-rt-text">
          {o.description}
        </div>
      ) : null}
      {o.eligibility ? (
        <Card className="mt-6 p-5">
          <h2 className="text-base font-semibold text-rt-text">Eligibility</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-rt-muted">{o.eligibility}</p>
        </Card>
      ) : null}

      {o.disciplines.length > 0 ? (
        <div className="mt-6 flex flex-wrap gap-1">
          {o.disciplines.map((d) => (
            <span key={d} className="rounded bg-rt-blue-light px-2 py-0.5 text-xs capitalize text-rt-blue-dark">
              {d}
            </span>
          ))}
        </div>
      ) : null}

      {/* Provenance — nothing is fabricated (Spec §57) */}
      <p className="mt-8 text-xs text-rt-muted">
        Source: {o.source ?? 'manual'}
        {o.sourceUrl ? (
          <>
            {' · '}
            <a href={o.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">
              original listing
            </a>
          </>
        ) : null}
        . Verify all details with the posting organization before applying.
      </p>
    </div>
  );
}
