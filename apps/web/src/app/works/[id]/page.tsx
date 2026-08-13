import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getUnifiedWorkByPublicId } from '@researchtrics/core';
import { Card, Badge } from '@researchtrics/ui';
import { SourceBadge } from '@/components/source-badge';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const work = await getUnifiedWorkByPublicId(id);
  return { title: work ? work.title : 'Unified work record' };
}

export const dynamic = 'force-dynamic';

/** Fields shown with their per-source provenance + conflicts. */
const DISPLAY_FIELDS: Array<{ field: string; label: string }> = [
  { field: 'title', label: 'Title' },
  { field: 'publishedYear', label: 'Published year' },
  { field: 'journalTitle', label: 'Journal' },
  { field: 'publisher', label: 'Publisher' },
  { field: 'abstract', label: 'Abstract' },
  { field: 'licenseCode', label: 'License' },
];

export default async function UnifiedWorkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const work = await getUnifiedWorkByPublicId(id);
  if (!work) notFound();

  const provByField = new Map<string, typeof work.fieldProvenance>();
  for (const p of work.fieldProvenance) {
    const list = provByField.get(p.field) ?? [];
    list.push(p);
    provByField.set(p.field, list);
  }
  const sources = Array.from(new Set(work.fieldProvenance.map((p) => p.source)));
  const externalIds = [
    ['DOI', work.doi],
    ['PMID', work.pmid],
    ['PMCID', work.pmcid],
    ['OpenAlex', work.openalexId],
    ['DataCite', work.dataciteId],
    ['OJS', work.ojsId],
  ].filter(([, v]) => !!v) as Array<[string, string]>;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="neutral" className="capitalize">{work.resourceType}</Badge>
        <Badge variant="outline" className="font-mono">{work.publicId}</Badge>
        <Badge variant="gold">Confidence {Math.round(work.confidence * 100)}%</Badge>
      </div>
      <h1 className="mt-3 text-2xl font-semibold text-rt-text">{work.title}</h1>

      <div className="mt-3 flex flex-wrap gap-2">
        <span className="text-xs text-rt-muted">Sources:</span>
        {sources.map((s) => (
          <SourceBadge key={s} source={s} />
        ))}
      </div>

      {externalIds.length > 0 ? (
        <Card className="mt-6 p-5">
          <h2 className="text-base font-semibold text-rt-text">Identifiers</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {externalIds.map(([k, v]) => (
              <li key={k} className="text-rt-muted">
                {k}: <span className="font-mono text-rt-text">{v}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {/* Per-field provenance + conflicts (§19, §29) */}
      <Card className="mt-6 p-5">
        <h2 className="text-base font-semibold text-rt-text">Field provenance</h2>
        <p className="mt-1 text-xs text-rt-muted">
          Each field's chosen value, the source it came from, and any disagreement between sources
          — nothing is silently overwritten.
        </p>
        <ul className="mt-4 space-y-4">
          {DISPLAY_FIELDS.map(({ field, label }) => {
            const rows = provByField.get(field);
            if (!rows || rows.length === 0) return null;
            const authoritative = rows.find((r) => r.authoritative) ?? rows[0]!;
            const hasConflict = rows[0]!.conflictStatus === 'conflict';
            return (
              <li key={field}>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-rt-text">{label}</span>
                  {hasConflict ? <Badge variant="warning">conflict</Badge> : null}
                  <SourceBadge source={authoritative.source} />
                </div>
                <p className="mt-1 text-sm text-rt-muted">{authoritative.value}</p>
                {hasConflict ? (
                  <ul className="mt-1 space-y-0.5">
                    {rows
                      .filter((r) => !r.authoritative)
                      .map((r) => (
                        <li key={r.id} className="text-xs text-rt-muted">
                          {r.source}: {r.value}
                        </li>
                      ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
