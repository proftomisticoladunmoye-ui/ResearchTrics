import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { administeredInstitutionIds } from '@researchtrics/core';
import { prisma } from '@researchtrics/db';
import { Card } from '@researchtrics/ui';
import { getCurrentUser } from '@/lib/current-user';

export const metadata: Metadata = {
  title: 'My Institutions',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function MyInstitutionsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const ids = administeredInstitutionIds(user.actor);
  const institutions = ids.length
    ? await prisma.institution.findMany({
        where: { id: { in: ids }, deletedAt: null },
        select: { id: true, name: true, slug: true, country: true },
        orderBy: { name: 'asc' },
      })
    : [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-2xl font-semibold text-rt-text">Institutions you administer</h1>
      {institutions.length === 0 ? (
        <Card className="mt-6 p-6">
          <p className="text-sm text-rt-muted">
            You do not administer any institution. Institution-admin access is granted by a platform
            administrator.
          </p>
        </Card>
      ) : (
        <ul className="mt-6 space-y-3">
          {institutions.map((inst) => (
            <li key={inst.id}>
              <Link href={`/institutions/${inst.slug}/admin`}>
                <Card className="flex items-center justify-between gap-4 p-5 transition-colors hover:bg-rt-blue-light">
                  <div>
                    <p className="font-medium text-rt-text">{inst.name}</p>
                    <p className="text-sm text-rt-muted">{inst.country ?? 'Institution'}</p>
                  </div>
                  <span className="text-sm text-rt-blue">Open admin →</span>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
