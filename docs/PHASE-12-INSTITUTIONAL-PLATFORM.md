# Phase 12 — Institutional Platform (Implementation Notes)

> **Status:** Implemented and validated (incl. real-DB smoke). Awaiting review.

Adds an institution-scoped admin platform: grounded aggregate dashboards, a member roster, an affiliation-verification workflow, and public institution stats — all built on the existing RBAC + tenant-isolation infrastructure with **no schema change** (Spec §26, §38, §49, §85).

## Delivered

### Core — `institution-portal.ts`
- **Authorization (tenant isolation, §49):** `canManageInstitution` / `requireInstitutionManage` decide institution-management rights via the existing `authorize()` seam; an admin scoped to institution A can never act on institution B. `administeredInstitutionIds` lists what an actor may administer.
- **Grounded aggregates:** `getInstitutionOverview` returns *live* counts over affiliated researchers — researchers, verified/pending affiliations, departments, publications, citations, open-access, projects/datasets/instruments/software, and an aggregate **RVM** summary (average/median/coverage, labelled prototype). Every number derives from real records; empty sets yield `null`, never a fabricated `0`.
- **`summarizeScores`** — pure, tested helper (average + median + count) behind the RVM aggregate.
- **Roster & queue:** `listInstitutionMembers`, `listPendingAffiliations`.
- **Admin actions (audited §85, tenant-isolated):** `verifyAffiliation` confirms a claimed affiliation, raises the researcher's identity verification to **institution level (2, §38)** without lowering a higher level, and audits the action; `revokeAffiliationVerification` reverses it (never deletes the record). Both re-check RBAC against the affiliation's own institution.

### Web (`apps/web`)
- **`/institutions/[slug]/admin`** — the portal: aggregate metric cards, aggregate-RVM (transparent prototype), a **verification queue** with Verify buttons, and a full member roster with Verify/Revoke. Guarded by `requireInstitutionAdmin` (tenant-isolated redirect).
- **`/dashboard/institution`** — chooser listing the institutions the signed-in user administers.
- **API:** `POST /api/v1/affiliations/[affiliationId]` (`{ verified }`) — authorization + audit enforced in core; the route only supplies the actor.
- Dashboard header shows an **Institution** link only to users who administer one; public `/institutions/[slug]` gains a grounded stat row (public researchers, departments).

## Validation results
- **Tests:** 67 passing (+9: `summarizeScores` + tenant-isolation authorization).
- **Type-check / Lint:** clean across all packages (sequential run).
- **Build:** institution admin + chooser routes compile.
- **Real-DB smoke:** 38/38 — overview counts match real records; one-pending/one-verified reflected; **non-admin verify is rejected (FORBIDDEN)**; tenant isolation holds (admin of A cannot manage B); admin verify confirms the affiliation and raises identity to institution level.

## Integrity notes (Spec §26, §38, §49, §85)
- No fabricated institutional metrics — every figure is a live aggregate over verified records.
- Tenant isolation enforced in core (not just the UI) and asserted in smoke.
- Verification confirms a claim and is audited + reversible; a verified affiliation is never overwritten blindly.

## Deferred (documented)
- Department-scoped admin views (schema + `department_admin` role already present).
- Institution-admin **granting** of roles / inviting members (platform-admin-seeded for now).
- Institution-level analytics time series and exportable reports.
- Institution editing (name/ROR/departments) UI — public profile + ROR already shown.

## Exit gate
Tenant-isolated institution admin portal with grounded aggregates, an audited affiliation-verification workflow, and public institution stats; verified against a live database. **STOP FOR REVIEW.**
