import Link from 'next/link';
import {
  listRecentPublicationDetails,
  checkGoogleScholarCompliance,
  scholarInputFromPublication,
  type CheckStatus,
} from '@researchtrics/core';
import { Card, Badge } from '@researchtrics/ui';

export const dynamic = 'force-dynamic';

const STATUS_VARIANT: Record<CheckStatus, 'success' | 'warning' | 'error'> = {
  pass: 'success',
  warning: 'warning',
  fail: 'error',
};

const STATUS_LABEL: Record<CheckStatus, string> = { pass: 'PASS', warning: 'WARNING', fail: 'FAIL' };

export default async function AdminScholarPage() {
  const pubs = await listRecentPublicationDetails(25);
  const reports = pubs.map((p) => ({
    slug: p.slug,
    title: p.title,
    report: checkGoogleScholarCompliance(scholarInputFromPublication(p)),
  }));

  return (
    <div>
      <h1 className="text-2xl font-semibold text-rt-text">Google Scholar compliance</h1>
      <p className="mt-1 max-w-2xl text-sm text-rt-muted">
        Technical checks for scholarly indexing (Spec §11, §70). Passing checks improve
        discoverability — indexing is never guaranteed.
      </p>

      {reports.length === 0 ? (
        <p className="mt-8 text-rt-muted">No publications to check yet.</p>
      ) : (
        <ul className="mt-8 space-y-4">
          {reports.map(({ slug, title, report }) => (
            <li key={slug}>
              <Card className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Link href={`/publications/${slug}`} className="font-medium text-rt-blue hover:underline">
                    {title}
                  </Link>
                  <div className="flex items-center gap-2 text-xs">
                    <Badge variant={STATUS_VARIANT[report.overall]}>
                      {STATUS_LABEL[report.overall]}
                    </Badge>
                    <span className="text-rt-muted">
                      {report.summary.pass} pass · {report.summary.warning} warn · {report.summary.fail} fail
                    </span>
                  </div>
                </div>
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm text-rt-muted">View checks</summary>
                  <ul className="mt-3 grid gap-1 sm:grid-cols-2">
                    {report.checks.map((c) => (
                      <li key={c.key} className="flex items-start gap-2 text-sm">
                        <Badge variant={STATUS_VARIANT[c.status]}>{STATUS_LABEL[c.status]}</Badge>
                        <span>
                          <span className="text-rt-text">{c.label}</span>
                          {c.detail ? <span className="block text-xs text-rt-muted">{c.detail}</span> : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
