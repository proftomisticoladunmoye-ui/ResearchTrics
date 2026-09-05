'use client';

import { useState } from 'react';
import { Card, Button } from '@researchtrics/ui';

/**
 * "Cite this Bulletin" (§18): the suggested APA citation with copy, plus
 * downloads in scholarly formats served by the citation export route.
 */
const DOWNLOADS: Array<{ format: string; label: string }> = [
  { format: 'bibtex', label: 'BibTeX' },
  { format: 'ris', label: 'RIS' },
  { format: 'endnote', label: 'EndNote' },
  { format: 'apa', label: 'APA (.txt)' },
];

export function BulletinCitations({ slug, suggested }: { slug: string; suggested: string; year?: number }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(suggested).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Card className="mt-10 p-5">
      <h2 className="text-base font-semibold text-rt-text">Cite this Bulletin</h2>
      <p className="mt-2 rounded-md border border-rt-border bg-rt-blue-light/20 p-3 text-sm leading-relaxed text-rt-text">
        {suggested}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button onClick={copy} size="sm" variant="secondary">{copied ? 'Copied' : 'Copy citation'}</Button>
        <span className="text-xs text-rt-muted">Download:</span>
        {DOWNLOADS.map((d) => (
          <a
            key={d.format}
            href={`/api/v1/research-bulletin/${slug}/citation?format=${d.format}`}
            className="rounded border border-rt-border px-2 py-1 text-xs text-rt-blue hover:bg-rt-blue-light/30"
          >
            {d.label}
          </a>
        ))}
      </div>
    </Card>
  );
}
