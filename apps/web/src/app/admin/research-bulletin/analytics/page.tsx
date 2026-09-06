import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, Badge } from '@researchtrics/ui';
import { getBulletinAnalytics, BULLETIN_TYPE_LABELS, type BulletinListItem } from '@researchtrics/core';
import { requireAdmin } from '@/lib/admin';

export const metadata: Metadata = { title: 'Bulletin analytics — Admin', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

function Stat({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs uppercase tracking-wide text-rt-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-rt-text">{typeof value === 'number' ? value.toLocaleString() : value}</p>
      {hint ? <p className="text-xs text-rt-muted">{hint}</p> : null}
    </Card>
  );
}

function num(n: number | null): string {
  return n == null ? '—' : String(n).padStart(3, '0');
}

function RankList({ heading, items, metric }: { heading: string; items: Array<{ b: BulletinListItem; n: number }>; metric: string }) {
  return (
    <Card className="p-5">
      <h2 className="text-sm font-semibold text-rt-text">{heading}</h2>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-rt-muted">No data yet.</p>
      ) : (
        <ol className="mt-3 space-y-2 text-sm">
          {items.map(({ b, n }) => (
            <li key={b.slug} className="flex items-center justify-between gap-3">
              <Link href={`/research-bulletin/${b.slug}`} className="min-w-0 truncate text-rt-blue hover:underline">
                No. {num(b.number)} · {b.title}
              </Link>
              <span className="shrink-0 tabular-nums text-rt-muted">{n.toLocaleString()} {metric}</span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

export default async function BulletinAnalyticsPage() {
  await requireAdmin();
  const a = await getBulletinAnalytics();

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-rt-text">Research Bulletin — analytics</h1>
          <p className="mt-1 text-sm text-rt-muted">
            Publication and citation intelligence. Citation counts are <strong>internal</strong> (on-platform,
            verified); external DOI citations arrive once bulletins carry DOIs and are counted separately.
          </p>
        </div>
        <Link href="/admin/research-bulletin" className="text-sm text-rt-blue hover:underline">← All bulletins</Link>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <Stat label="Published" value={a.totals.published} />
        <Stat label="Total views" value={a.totals.views} hint="bot-filtered aggregate" />
        <Stat label="PDF downloads" value={a.totals.downloads} />
        <Stat label="Internal citations" value={a.totals.internalCitations} />
        <Stat label="Drafts" value={a.totals.drafts} />
        <Stat label="In review" value={a.totals.inReview} />
        <Stat label="With DOI" value={a.totals.withDoi} />
        <Stat label="Archived" value={a.totals.archived} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <RankList heading="Most viewed" metric="views" items={a.mostViewed.map((b) => ({ b, n: b.viewCount }))} />
        <RankList heading="Most cited (internal)" metric="citations" items={a.mostCited.map((c) => ({ b: c.bulletin, n: c.citations }))} />
        <RankList heading="Most downloaded" metric="downloads" items={a.mostDownloaded.map((b) => ({ b, n: b.downloadCount }))} />
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-rt-text">By category</h2>
          {a.byCategory.length === 0 ? (
            <p className="mt-2 text-sm text-rt-muted">No data yet.</p>
          ) : (
            <ul className="mt-3 space-y-1 text-sm">
              {a.byCategory.map((c) => (
                <li key={c.category} className="flex justify-between">
                  <span className="text-rt-text">{c.category}</span>
                  <span className="tabular-nums text-rt-muted">{c.count}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-6 p-5">
        <h2 className="text-sm font-semibold text-rt-text">By bulletin type</h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {a.byType.map((t) => (
            <li key={t.type}>
              <Badge variant="neutral">{BULLETIN_TYPE_LABELS[t.type]} · {t.count}</Badge>
            </li>
          ))}
          {a.byType.length === 0 ? <span className="text-sm text-rt-muted">No data yet.</span> : null}
        </ul>
      </Card>
    </div>
  );
}
