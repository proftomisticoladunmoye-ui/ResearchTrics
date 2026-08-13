import Link from 'next/link';
import { listReviewQueue } from '@researchtrics/core';
import { Card, Badge } from '@researchtrics/ui';
import { MergeButton } from '@/components/merge-button';

export const dynamic = 'force-dynamic';

export default async function AdminReviewPage() {
  const queue = await listReviewQueue();

  return (
    <div>
      <h1 className="text-2xl font-semibold text-rt-text">Identity review</h1>
      <p className="mt-1 text-sm text-rt-muted">
        Profiles that may be the same researcher, surfaced for human review. Nothing is merged
        automatically — name alone is never sufficient evidence (§25). Review the evidence, then
        merge duplicates into a single canonical profile.
      </p>

      {queue.length === 0 ? (
        <Card className="mt-6 p-6">
          <p className="text-sm text-rt-muted">Nothing needs review.</p>
        </Card>
      ) : (
        <div className="mt-6 space-y-4">
          {queue.map((group) => {
            const [canonical, ...rest] = group.researchers;
            return (
              <Card key={group.key} className="p-5">
                <p className="text-xs uppercase text-rt-muted">{group.reason}</p>
                <ul className="mt-3 space-y-2">
                  {group.researchers.map((r, i) => (
                    <li key={r.id} className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <Link href={`/researchers/${r.slug}`} className="text-sm font-medium text-rt-blue hover:underline">
                          {r.displayName}
                        </Link>
                        <span className="ml-2 text-xs text-rt-muted">
                          {r.identityConfidence != null ? `confidence ${r.identityConfidence}` : 'no score'}
                        </span>
                        {i === 0 ? <Badge variant="neutral" className="ml-2">Canonical</Badge> : null}
                      </div>
                      <Badge variant="outline">{r.profileStatus}</Badge>
                    </li>
                  ))}
                </ul>
                {canonical && rest.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {rest.map((d) => (
                      <MergeButton key={d.id} canonicalId={canonical.id} duplicateId={d.id} />
                    ))}
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
