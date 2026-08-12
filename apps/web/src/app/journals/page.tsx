import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@researchtrics/db';
import { Card } from '@researchtrics/ui';

export const metadata: Metadata = {
  title: 'Journals',
  description: 'Journals indexed on ResearchTrics.',
};

export const dynamic = 'force-dynamic';

export default async function JournalsPage() {
  const journals = await prisma.journal.findMany({ orderBy: { name: 'asc' }, take: 100 });

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-2xl font-semibold text-rt-text">Journals</h1>
      {journals.length === 0 ? (
        <p className="mt-6 text-rt-muted">No journals yet.</p>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {journals.map((j) => (
            <li key={j.id}>
              <Link href={`/journals/${j.slug}`}>
                <Card className="p-5 transition-colors hover:bg-rt-blue-light">
                  <p className="font-semibold text-rt-text">{j.name}</p>
                  <p className="mt-1 text-sm text-rt-muted">
                    {j.issnElectronic ?? j.issnPrint ?? j.publisher ?? 'Journal'}
                  </p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
