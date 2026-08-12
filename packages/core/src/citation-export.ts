/**
 * Citation exporters (Spec §10). Pure, deterministic formatters — unit-tested.
 * Formats: BibTeX, RIS, EndNote, APA, Vancouver, Chicago.
 */

export interface CitationAuthor {
  given?: string | undefined;
  family?: string | undefined;
  /** Fallback when given/family are unavailable. */
  literal?: string | undefined;
}

export interface CitationData {
  title: string;
  authors: CitationAuthor[];
  year?: number | undefined;
  journalTitle?: string | undefined;
  volume?: string | undefined;
  issue?: string | undefined;
  firstPage?: string | undefined;
  lastPage?: string | undefined;
  doi?: string | undefined;
  publisher?: string | undefined;
  url?: string | undefined;
}

export type CitationFormat = 'bibtex' | 'ris' | 'endnote' | 'apa' | 'vancouver' | 'chicago';

export const CITATION_FORMATS: Record<CitationFormat, { label: string; extension: string; mime: string }> = {
  bibtex: { label: 'BibTeX', extension: 'bib', mime: 'application/x-bibtex' },
  ris: { label: 'RIS', extension: 'ris', mime: 'application/x-research-info-systems' },
  endnote: { label: 'EndNote', extension: 'enw', mime: 'application/x-endnote-refer' },
  apa: { label: 'APA', extension: 'txt', mime: 'text/plain' },
  vancouver: { label: 'Vancouver', extension: 'txt', mime: 'text/plain' },
  chicago: { label: 'Chicago', extension: 'txt', mime: 'text/plain' },
};

function pages(d: CitationData): string | undefined {
  if (d.firstPage && d.lastPage) return `${d.firstPage}-${d.lastPage}`;
  return d.firstPage ?? undefined;
}

function initials(given?: string): string {
  if (!given) return '';
  return given
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((p) => `${p[0]?.toUpperCase()}.`)
    .join(' ');
}

function fullName(a: CitationAuthor): string {
  if (a.family || a.given) return [a.given, a.family].filter(Boolean).join(' ');
  return a.literal ?? 'Unknown';
}

export function formatCitation(data: CitationData, format: CitationFormat): string {
  switch (format) {
    case 'bibtex':
      return toBibTeX(data);
    case 'ris':
      return toRIS(data);
    case 'endnote':
      return toEndNote(data);
    case 'apa':
      return toAPA(data);
    case 'vancouver':
      return toVancouver(data);
    case 'chicago':
      return toChicago(data);
  }
}

export function bibtexKey(data: CitationData): string {
  const first = data.authors[0];
  const name = (first?.family ?? first?.literal ?? 'anon').replace(/[^A-Za-z]/g, '').toLowerCase();
  return `${name}${data.year ?? ''}`;
}

export function toBibTeX(d: CitationData): string {
  const fields: Array<[string, string | undefined]> = [
    ['title', d.title],
    ['author', d.authors.map(fullName).join(' and ') || undefined],
    ['journal', d.journalTitle],
    ['year', d.year?.toString()],
    ['volume', d.volume],
    ['number', d.issue],
    ['pages', pages(d)],
    ['publisher', d.publisher],
    ['doi', d.doi],
  ];
  const body = fields
    .filter(([, v]) => v)
    .map(([k, v]) => `  ${k} = {${v}}`)
    .join(',\n');
  return `@article{${bibtexKey(d)},\n${body}\n}`;
}

export function toRIS(d: CitationData): string {
  const lines: string[] = ['TY  - JOUR'];
  for (const a of d.authors) lines.push(`AU  - ${risAuthor(a)}`);
  lines.push(`TI  - ${d.title}`);
  if (d.journalTitle) lines.push(`JO  - ${d.journalTitle}`);
  if (d.year) lines.push(`PY  - ${d.year}`);
  if (d.volume) lines.push(`VL  - ${d.volume}`);
  if (d.issue) lines.push(`IS  - ${d.issue}`);
  if (d.firstPage) lines.push(`SP  - ${d.firstPage}`);
  if (d.lastPage) lines.push(`EP  - ${d.lastPage}`);
  if (d.doi) lines.push(`DO  - ${d.doi}`);
  if (d.publisher) lines.push(`PB  - ${d.publisher}`);
  lines.push('ER  - ');
  return lines.join('\n');
}

function risAuthor(a: CitationAuthor): string {
  if (a.family) return `${a.family}, ${a.given ?? ''}`.trim();
  return a.literal ?? fullName(a);
}

export function toEndNote(d: CitationData): string {
  const lines: string[] = ['%0 Journal Article'];
  for (const a of d.authors) lines.push(`%A ${risAuthor(a)}`);
  lines.push(`%T ${d.title}`);
  if (d.journalTitle) lines.push(`%J ${d.journalTitle}`);
  if (d.year) lines.push(`%D ${d.year}`);
  if (d.volume) lines.push(`%V ${d.volume}`);
  if (d.issue) lines.push(`%N ${d.issue}`);
  const p = pages(d);
  if (p) lines.push(`%P ${p}`);
  if (d.doi) lines.push(`%R ${d.doi}`);
  return lines.join('\n');
}

export function toAPA(d: CitationData): string {
  const formatted = d.authors.map((a) => (a.family ? `${a.family}, ${initials(a.given)}`.trim() : fullName(a)));
  const authorStr =
    formatted.length <= 1
      ? (formatted[0] ?? '')
      : `${formatted.slice(0, -1).join(', ')}, & ${formatted[formatted.length - 1]}`;
  const parts: string[] = [];
  if (authorStr) parts.push(`${authorStr}`);
  parts.push(`(${d.year ?? 'n.d.'}).`);
  parts.push(`${d.title}.`);
  if (d.journalTitle) {
    let jp = d.journalTitle;
    if (d.volume) jp += `, ${d.volume}`;
    if (d.issue) jp += `(${d.issue})`;
    const p = pages(d);
    if (p) jp += `, ${p}`;
    parts.push(`${jp}.`);
  }
  if (d.doi) parts.push(`https://doi.org/${d.doi}`);
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

export function toVancouver(d: CitationData): string {
  const authorStr = d.authors
    .map((a) => (a.family ? `${a.family} ${initials(a.given).replace(/\./g, '')}`.trim() : fullName(a)))
    .join(', ');
  let s = '';
  if (authorStr) s += `${authorStr}. `;
  s += `${d.title}. `;
  if (d.journalTitle) s += `${d.journalTitle}. `;
  s += `${d.year ?? 'n.d.'}`;
  if (d.volume) s += `;${d.volume}`;
  if (d.issue) s += `(${d.issue})`;
  const p = pages(d);
  if (p) s += `:${p}`;
  s += '.';
  return s.replace(/\s+/g, ' ').trim();
}

export function toChicago(d: CitationData): string {
  const first = d.authors[0];
  const authorStr = first
    ? d.authors
        .map((a, i) =>
          i === 0
            ? a.family
              ? `${a.family}, ${a.given ?? ''}`.trim()
              : fullName(a)
            : fullName(a),
        )
        .join(', ')
    : '';
  const parts: string[] = [];
  if (authorStr) parts.push(`${authorStr}.`);
  if (d.year) parts.push(`${d.year}.`);
  parts.push(`"${d.title}."`);
  if (d.journalTitle) {
    let jp = d.journalTitle;
    if (d.volume) jp += ` ${d.volume}`;
    if (d.issue) jp += ` (${d.issue})`;
    const p = pages(d);
    if (p) jp += `: ${p}`;
    parts.push(`${jp}.`);
  }
  if (d.doi) parts.push(`https://doi.org/${d.doi}.`);
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}
