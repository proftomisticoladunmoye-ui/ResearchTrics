import type { PublicationDetail } from './publication';

/**
 * Google Scholar technical-compliance checker (Spec §11, §70). Pure and
 * deterministic so it can be run in CI and the admin dashboard. Produces
 * PASS / WARNING / FAIL per check.
 *
 * Honesty: this verifies the metadata and structural signals the platform
 * controls. It never claims indexing is guaranteed (Spec §83). Some checks the
 * platform always satisfies by construction (unique URL, canonical, structured
 * data, robots) are reported PASS with a note; the substantive signal is
 * metadata completeness and PDF text extractability.
 */

export type CheckStatus = 'pass' | 'warning' | 'fail';

export interface ComplianceCheck {
  key: string;
  label: string;
  status: CheckStatus;
  detail?: string;
}

export interface ComplianceReport {
  checks: ComplianceCheck[];
  summary: { pass: number; warning: number; fail: number };
  overall: CheckStatus;
}

export interface ScholarInput {
  title?: string | null;
  authorCount: number;
  publicationDate?: string | null; // ISO date or year string
  journalTitle?: string | null;
  issn?: string | null;
  volume?: string | null;
  issue?: string | null;
  firstPage?: string | null;
  lastPage?: string | null;
  doi?: string | null;
  abstract?: string | null;
  pdfUrl?: string | null;
  isPublic: boolean;
  /** Present when the PDF is hosted by us (external links can't be introspected). */
  hostedPdf?: { hasText: boolean | null; sizeBytes: number } | null;
}

const PDF_MAX_BYTES = 30 * 1024 * 1024; // Scholar-friendly size ceiling

function present(v: unknown): boolean {
  return typeof v === 'string' ? v.trim().length > 0 : v != null;
}

/** Build checker input from a loaded publication. */
export function scholarInputFromPublication(pub: PublicationDetail): ScholarInput {
  const doi = pub.identifiers.find((i) => i.scheme === 'doi')?.value ?? null;
  const input: ScholarInput = {
    title: pub.title,
    authorCount: pub.authors.length,
    publicationDate: pub.publishedOn ? pub.publishedOn.toISOString().slice(0, 10) : pub.publishedYear ? String(pub.publishedYear) : null,
    journalTitle: pub.journal?.name ?? null,
    issn: pub.journal?.issnElectronic ?? pub.journal?.issnPrint ?? null,
    volume: pub.volume,
    issue: pub.issue,
    firstPage: pub.firstPage,
    lastPage: pub.lastPage,
    doi,
    abstract: pub.abstract,
    pdfUrl: pub.pdfUrl,
    isPublic: pub.visibility === 'public',
    hostedPdf: null,
  };
  return input;
}

export function checkGoogleScholarCompliance(input: ScholarInput): ComplianceReport {
  const checks: ComplianceCheck[] = [];
  const add = (key: string, label: string, status: CheckStatus, detail?: string) =>
    checks.push(detail ? { key, label, status, detail } : { key, label, status });

  // Structural signals the platform emits for every public publication.
  add('unique_url', 'Unique canonical URL', 'pass', 'One publication = one server-rendered URL.');
  add('canonical', 'Canonical link tag', 'pass');
  add('structured_data', 'schema.org ScholarlyArticle (JSON-LD)', 'pass');
  add(
    'crawlability',
    'Crawlable / robots',
    input.isPublic ? 'pass' : 'fail',
    input.isPublic ? undefined : 'Non-public publications are intentionally not indexable.',
  );

  // Core bibliographic metadata (Highwire citation_* tags).
  add('html_title', 'HTML title', present(input.title) ? 'pass' : 'fail');
  add('citation_title', 'citation_title', present(input.title) ? 'pass' : 'fail');
  add('citation_author', 'citation_author', input.authorCount > 0 ? 'pass' : 'fail');
  add(
    'citation_publication_date',
    'citation_publication_date',
    present(input.publicationDate) ? 'pass' : 'warning',
    present(input.publicationDate) ? undefined : 'Add a publication date to improve indexing.',
  );
  add(
    'citation_journal_title',
    'citation_journal_title',
    present(input.journalTitle) ? 'pass' : 'warning',
  );
  add('citation_issn', 'citation_issn', present(input.issn) ? 'pass' : 'warning');
  add('citation_volume', 'citation_volume', present(input.volume) ? 'pass' : 'warning');
  add('citation_issue', 'citation_issue', present(input.issue) ? 'pass' : 'warning');
  add('citation_firstpage', 'citation_firstpage', present(input.firstPage) ? 'pass' : 'warning');
  add('citation_lastpage', 'citation_lastpage', present(input.lastPage) ? 'pass' : 'warning');

  // Abstract visibility (must be readable without login).
  add(
    'abstract_visibility',
    'Public abstract',
    !input.isPublic ? 'fail' : present(input.abstract) ? 'pass' : 'warning',
    !input.isPublic
      ? 'Abstract is not publicly visible.'
      : present(input.abstract)
        ? undefined
        : 'No abstract present.',
  );

  // Full text / PDF.
  add(
    'citation_pdf_url',
    'citation_pdf_url (full text)',
    present(input.pdfUrl) ? 'pass' : 'warning',
    present(input.pdfUrl) ? undefined : 'A linked full-text PDF improves discoverability where licensing permits.',
  );

  if (input.hostedPdf) {
    add(
      'pdf_text_extractable',
      'PDF has extractable text',
      input.hostedPdf.hasText ? 'pass' : 'fail',
      input.hostedPdf.hasText ? undefined : 'Image-only PDFs are not indexable — provide a text PDF.',
    );
    add(
      'pdf_size',
      'PDF size within limits',
      input.hostedPdf.sizeBytes <= PDF_MAX_BYTES ? 'pass' : 'warning',
      input.hostedPdf.sizeBytes <= PDF_MAX_BYTES ? undefined : 'PDF is large; consider optimizing.',
    );
  } else if (present(input.pdfUrl)) {
    add('pdf_text_extractable', 'PDF has extractable text', 'warning', 'External PDF — text extractability not verified.');
  }

  // Overall metadata completeness.
  const coreFields = [input.title, input.publicationDate, input.journalTitle, input.abstract];
  const filled = coreFields.filter(present).length;
  add(
    'metadata_completeness',
    'Metadata completeness',
    filled === coreFields.length ? 'pass' : filled >= 2 ? 'warning' : 'fail',
    `${filled}/${coreFields.length} core fields present.`,
  );

  const summary = {
    pass: checks.filter((c) => c.status === 'pass').length,
    warning: checks.filter((c) => c.status === 'warning').length,
    fail: checks.filter((c) => c.status === 'fail').length,
  };
  const overall: CheckStatus = summary.fail > 0 ? 'fail' : summary.warning > 0 ? 'warning' : 'pass';
  return { checks, summary, overall };
}
