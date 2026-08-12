import Link from 'next/link';
import { prisma } from '@researchtrics/db';
import { Badge } from '@researchtrics/ui';

export const dynamic = 'force-dynamic';

export default async function AdminResearchersPage() {
  const researchers = await prisma.researcher.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: { id: true, displayName: true, slug: true, researchtricsId: true, verificationLevel: true },
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-rt-text">Researchers</h1>
      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-rt-border text-left text-rt-muted">
              <th className="py-2 pr-4 font-medium">Name</th>
              <th className="py-2 pr-4 font-medium">RTX ID</th>
              <th className="py-2 pr-4 font-medium">Verification</th>
            </tr>
          </thead>
          <tbody>
            {researchers.map((r) => (
              <tr key={r.id} className="border-b border-rt-border">
                <td className="py-2 pr-4">
                  <Link href={`/researchers/${r.slug}`} className="text-rt-blue hover:underline">
                    {r.displayName}
                  </Link>
                </td>
                <td className="py-2 pr-4 font-mono text-rt-muted">{r.researchtricsId}</td>
                <td className="py-2 pr-4">
                  <Badge variant="outline">Level {r.verificationLevel}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
