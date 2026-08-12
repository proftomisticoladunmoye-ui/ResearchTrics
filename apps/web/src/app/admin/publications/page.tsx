import Link from 'next/link';
import { prisma } from '@researchtrics/db';

export const dynamic = 'force-dynamic';

export default async function AdminPublicationsPage() {
  const publications = await prisma.publication.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { journal: { select: { name: true } } },
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-rt-text">Publications</h1>
      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-rt-border text-left text-rt-muted">
              <th className="py-2 pr-4 font-medium">Title</th>
              <th className="py-2 pr-4 font-medium">Journal</th>
              <th className="py-2 pr-4 font-medium">Year</th>
            </tr>
          </thead>
          <tbody>
            {publications.map((p) => (
              <tr key={p.id} className="border-b border-rt-border">
                <td className="py-2 pr-4">
                  <Link href={`/publications/${p.slug}`} className="text-rt-blue hover:underline">
                    {p.title}
                  </Link>
                </td>
                <td className="py-2 pr-4 text-rt-muted">{p.journal?.name ?? '—'}</td>
                <td className="py-2 pr-4 tabular-nums">{p.publishedYear ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
