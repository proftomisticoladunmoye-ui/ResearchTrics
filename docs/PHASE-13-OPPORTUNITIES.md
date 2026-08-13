# Phase 13 — Opportunities (Implementation Notes)

> **Status:** Implemented and validated (incl. real-DB smoke). Awaiting review.

Adds forward-looking research **opportunities** (grants, fellowships, calls, positions) with provenance-backed curation and **explainable** researcher matching (Spec §20, §29, §57, §85).

## Delivered

### Data model (`packages/db`)
- **`Opportunity`** — `RTO-00000001` public id, type/status enums, deadline, funding range, `disciplines[]` (matching tags), funder/institution links, and **provenance** (`source`, `sourceUrl`, `postedBy`). **`OpportunitySave`** — researcher bookmarks. New `opportunity_rto_seq` sequence + `nextOpportunitySerial` + `formatOpportunityId`. Back-relations on Funder/Institution/User/Researcher. Migration regenerated (**43 tables**).

### RBAC (`rbac.ts`)
- New `opportunity:create` / `opportunity:manage` permissions granted to **funder, employer, research_administrator, institution_admin, platform_admin, super_admin**. Plain researchers cannot post.

### Core — `opportunities.ts`
- **`createOpportunity`** (RBAC-guarded, provenance defaulted to `manual`, audited), `setOpportunityStatus`, `listOpportunities` (filters + `openOnly` excludes closed/past-deadline), `getOpportunityBySlug`.
- **Saves:** `saveOpportunity` / `unsaveOpportunity` / `listSavedOpportunities`.
- **`scoreOpportunityMatch`** — pure, tested scorer that **always produces reasons** (discipline overlap primary; institution; country; imminent deadline secondary). Never an unexplained score (Spec §29).
- **`recommendOpportunities`** — matches only **live** listings (open, not past deadline) against the researcher's interests + affiliations, and **excludes any match without a profile-based reason** — a near deadline alone never surfaces an opportunity.

### Web (`apps/web`)
- Public **`/opportunities`** list + **`/opportunities/[slug]`** detail (type/status, funding, deadline, eligibility, disciplines, **provenance line + original-source link**, Apply button, Save for researchers).
- **`/dashboard/opportunities`** — explained recommendations + saved list; "Post an opportunity" for authorized posters.
- **`/dashboard/opportunities/new`** — RBAC-guarded post form.
- API: `POST /api/v1/opportunities` (create), `POST /api/v1/opportunities/[id]/save` (toggle). Primary-nav + dashboard links.

## Validation results
- **Tests:** 75 passing (+8: `scoreOpportunityMatch` explainability + posting authorization).
- **Type-check / Lint:** clean across all packages (sequential run).
- **Build:** opportunities routes compile.
- **Real-DB smoke:** 46/46 — **non-poster create rejected (FORBIDDEN)**; funder create mints `RTO-…` with `source=manual`; open listing appears publicly; recommendation surfaces the interest-matching opportunity **with its reason**; save/unsave work.

## Integrity notes (Spec §20, §29, §57, §85)
- **Provenance on every listing** — `source`/`sourceUrl`/`postedBy`; the detail page tells applicants to verify with the posting organization. Nothing is fabricated.
- **Every match is explained** and grounded in the researcher's own interests/affiliations; unexplained matches are filtered out.
- Posting is RBAC-gated and audited.

## Deferred (documented)
- Opportunity search-index integration (matching + list/filter cover discovery for now).
- Bulk import of opportunities from external feeds (schema's `source`/`sourceUrl` already support provenance).
- Application tracking / status beyond bookmarking; poster-side applicant matching.
- Opportunity edit UI (create + status change exist; full edit later).

## Exit gate
Provenance-backed opportunity listings, RBAC-gated posting, and explained researcher matching that never fabricates a listing; verified against a live database. **STOP FOR REVIEW.**
