# Phase 5 — Google Scholar Optimization (Implementation Notes)

> **Status:** Implemented and validated. Awaiting review before Phase 6.

Hardens the discoverability work Phase 3 began: per-type sitemaps, robots, and a real compliance checker + test suite.

## Delivered

### Compliance checker (`packages/core/scholar-compliance.ts`)
- **Pure, deterministic** `checkGoogleScholarCompliance(input)` → PASS/WARNING/FAIL across the full Spec §70 checklist, with an `overall` verdict and per-check detail.
- `scholarInputFromPublication` derives the input from a loaded publication.
- **Unit-tested** (5 cases) so it runs in CI (Spec §70).

### Sitemaps & robots (`apps/web`)
- **Sitemap index** `/sitemap.xml` → **per-type** `/sitemaps/{researchers|publications|institutions|journals}`. Public content only (Spec §42, §71).
- `robots.txt` already allows scholarly crawling of public content and references the sitemap.
- XML helpers with proper escaping; 5,000-URL cap per type (sharding is a later ops step).

### Admin (`/admin/scholar`)
Lists recent publications with an overall PASS/WARNING/FAIL badge and expandable per-check breakdown. Added to admin nav.

### Supporting pages
Minimal `/journals` and `/journals/[slug]` (canonical + publications) so journal sitemap URLs resolve and the footer link works.

### Already emitted (Phase 3, reaffirmed)
`citation_*` Highwire meta + `ScholarlyArticle` JSON-LD + canonical on publication pages; `Person` JSON-LD on profiles.

## Validation results
- **Tests:** 54 passing (+5 checker).
- **Type-check / Lint:** clean across all 11 packages.
- **Build:** all routes incl. sitemap index, per-type sitemaps, `/admin/scholar`, journals compile.

## Integrity notes (Spec §83)
- **No claim of guaranteed indexing** anywhere in code or copy.
- Checker is honest about what it can verify (metadata + hosted-PDF text); external PDFs → WARNING (not verifiable), image-only hosted PDFs → FAIL.
- Only public content appears in sitemaps; private surfaces disallowed in robots.

## Deferred within the phase (documented)
- Sitemap sharding beyond 5k URLs/type.
- Live crawl verification (needs the running app + real content).
- Per-publication on-demand checker API (dashboard computes server-side already).

## Exit gate
Sample publication passes the checker; checker test suite green in CI; per-type sitemaps + index serve valid XML of public content; admin Scholar dashboard renders verdicts. **STOP FOR REVIEW** before Phase 6 (Research Projects & Outputs).
