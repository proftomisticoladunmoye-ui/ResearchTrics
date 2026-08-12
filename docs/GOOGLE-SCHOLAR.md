# Google Scholar Discoverability

> **Status:** Implemented in Phase 5. **We never claim indexing is guaranteed** (Spec §83). Our job is technical compliance + crawlability.

## What ResearchTrics guarantees per publication (Spec §11)

Every public `/publications/{slug}` page is **server-rendered** and emits:

- **Highwire `citation_*` meta**: `citation_title`, `citation_author` (repeated, order-preserved), `citation_publication_date`, `citation_journal_title`, `citation_issn`, `citation_volume`, `citation_issue`, `citation_firstpage`, `citation_lastpage`, `citation_doi`, `citation_pdf_url` — each emitted where the datum exists.
- **`schema.org/ScholarlyArticle` JSON-LD**, canonical `<link>`, OpenGraph.
- **Public abstract with no login wall**; full text via `citation_pdf_url` where licensing permits.
- One paper = one unique canonical URL (slugged). No multiple papers per URL/PDF.

Researcher pages emit `Person` JSON-LD + canonical.

## Site-level (Spec §42, §71)

- **`robots.txt`** (`/robots.txt`) allows crawling of public content, disallows `/dashboard`, `/admin`, `/api/`, and references the sitemap.
- **Sitemap index** at `/sitemap.xml` → **per-type sitemaps**: `/sitemaps/researchers`, `/sitemaps/publications`, `/sitemaps/institutions`, `/sitemaps/journals`. **Only public content is included.** (Sharding beyond 5,000 URLs/type is a later ops step.)

## Google Scholar Compliance Checker (Spec §11, §70)

A **pure, deterministic** checker (`checkGoogleScholarCompliance`) grades each publication **PASS / WARNING / FAIL** across:

unique URL · HTML title · `citation_title` · `citation_author` · `citation_publication_date` · `citation_journal_title` · `citation_issn` · `citation_volume` · `citation_issue` · `citation_firstpage` · `citation_lastpage` · `citation_pdf_url` · canonical · public abstract · crawlability/robots · structured data · PDF text-extractability · PDF size · metadata completeness.

- **Admin dashboard:** `/admin/scholar` lists recent publications with an overall badge + expandable per-check detail.
- **Automated test suite:** the checker is unit-tested (complete → PASS; non-public → FAIL; missing title/authors → FAIL; image-only hosted PDF → FAIL; missing optional metadata → WARNING) so it runs in CI (Spec §70).

### Honesty of the checker

It verifies the signals the platform controls. Structural checks the platform always emits (unique URL, canonical, structured data, robots) report PASS with a note; the substantive signals are **metadata completeness** and, for hosted files, **PDF text extractability** (image-only PDFs are rejected at upload and flagged FAIL). External PDFs are marked WARNING for text extractability because they cannot be introspected.

## PDF policy (Spec §11)

Hosted PDFs must contain **searchable text**; image-only PDFs are rejected at upload (`pdfLikelyHasText`) and would fail the checker. Copyright/licensing is respected — full-text hosting requires a rights declaration.

## What is NOT claimed

- No guarantee of Google Scholar (or any index) inclusion.
- No scraping of Google Scholar or other databases.
