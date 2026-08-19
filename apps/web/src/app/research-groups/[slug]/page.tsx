import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getGroupBySlug } from '@researchtrics/core';
import { Card, Avatar, Badge } from '@researchtrics/ui';
import { getCurrentUser } from '@/lib/current-user';
import { JoinGroupButton } from '@/components/join-group-button';

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const g = await getGroupBySlug(slug);
  if (!g) return { title: 'Research Group' };
  return { title: g.name, description: g.description?.slice(0, 200) ?? g.name, alternates: { canonical: `${appUrl}/research-groups/${g.slug}` } };
}

export default async function GroupPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const g = await getGroupBySlug(slug);
  if (!g) notFound();

  const user = await getCurrentUser();
  const myResearcherId = user?.researcher?.id;
  const isMember = !!myResearcherId && g.members.some((m) => m.researcherId === myResearcherId);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-rt-text">{g.name}</h1>
          <p className="mt-1 text-sm text-rt-muted">
            {g.institution?.name ? `${g.institution.name} · ` : ''}
            {g.members.length} member{g.members.length === 1 ? '' : 's'}
            {g.lead ? <> · Led by <Link href={`/researchers/${g.lead.slug}`} className="text-rt-blue hover:underline">{g.lead.displayName}</Link></> : null}
          </p>
        </div>
        {myResearcherId ? <JoinGroupButton groupId={g.id} isMember={isMember} /> : null}
      </div>

      {g.description ? <p className="mt-5 whitespace-pre-line text-rt-text">{g.description}</p> : null}

      {g.interests ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {g.interests.split(',').map((i) => i.trim()).filter(Boolean).map((i) => (
            <Badge key={i} variant="neutral">{i}</Badge>
          ))}
        </div>
      ) : null}

      <h2 className="mt-8 text-base font-semibold text-rt-text">Members</h2>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {g.members.map((m) => (
          <li key={m.id}>
            <Link href={`/researchers/${m.researcher.slug}`}>
              <Card className="flex items-center gap-3 p-4 transition-colors hover:bg-rt-blue-light">
                <Avatar name={m.researcher.displayName} src={m.researcher.photoUrl ?? undefined} size="sm" />
                <div className="min-w-0">
                  <p className="truncate font-medium text-rt-text">{m.researcher.displayName}</p>
                  <p className="truncate text-sm text-rt-muted">{m.role ?? m.researcher.academicRank ?? 'Member'}</p>
                </div>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
