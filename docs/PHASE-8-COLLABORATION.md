# Phase 8 — Research Collaboration (Implementation Notes)

> **Status:** Implemented and validated (incl. real-DB smoke). Awaiting review.

Adds explainable collaborator discovery, collaboration requests, and research groups (Spec §18, §27, §29).

## Delivered

### Data model (`packages/db`)
`ResearchGroup`, `ResearchGroupMember`, `CollaborationRequest` (+ `CollaborationRequestStatus`) with researcher/institution back-relations. Migration regenerated (41 tables).

### Core
- **`collaboration.ts`**
  - `scoreCollaborator` — pure, tested scorer that **always produces reasons** (shared interests, same institution, same country). Never an unexplained score (Spec §29).
  - `recommendCollaborators` — gathers candidates sharing interests or an institution, **excludes self, existing co-authors, and anyone already in a request**, and returns ranked, explained recommendations.
  - Requests: `createCollaborationRequest` (self/duplicate guarded), `listIncoming`/`listOutgoing`, `respondToRequest` (recipient-only, audited).
- **`groups.ts`** — `createGroup` (lead auto-added as member), `getGroupBySlug`, `listGroups`, `addGroupMember`.

### Web (`apps/web`)
- Public `/research-groups` + `/research-groups/[slug]` (members, lead, interests, **Join** button).
- **`/dashboard/collaborate`** — recommended collaborators *with their reasons* + **Request collaboration**, incoming requests (**Accept/Decline**), sent requests, and a **create-group** form.
- **Connect button** on researcher profiles (signed-in, non-owner).
- API: `POST /api/v1/collaboration/requests`, `…/requests/[id]/respond`, `POST /api/v1/research-groups`, `…/[id]/join`.
- Dashboard + footer navigation.

## Validation results
- **Tests:** 52 passing (+5 collaboration scorer).
- **Type-check / Lint:** clean across all 12 packages.
- **Build:** collaboration routes compile.
- **Real-DB smoke:** recommendation surfaces the interest-sharing candidate *with reasons*; request accept flow works; group create + join work (see smoke output).

## Integrity notes (Spec §18, §29)
- **Every recommendation is explained** — the engine filters out any candidate with no reason.
- Recommendations **complement** existing collaboration (co-authors and existing requests are excluded), and never surface the researcher themselves.
- Requests are recipient-authorised and audited (Spec §68).

## Deferred (documented)
- Topic/methodology-based matching (needs the topic model; interests + institution used for now).
- Group join *requests/approvals* (open join for MVP; approval workflow later).
- Group-scoped RBAC admin actions (schema + scope enum already support it).
- Notifications for incoming requests (notification system is a later phase).

## Exit gate
Explained collaborator recommendations; collaboration request send/accept/decline; research group create/join with a public profile; verified against a live database. **STOP FOR REVIEW.**
