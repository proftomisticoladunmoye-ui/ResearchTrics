# Phase 14 — Research Graph (Implementation Notes)

> **Status:** Implemented and validated (incl. real-DB smoke). Awaiting review.

Adds a **research graph** — a live, grounded projection of the platform's verified relationships — with explainable connection paths (Spec §21, §29). **No schema change:** the graph is computed from existing records, never a separate fabricated store.

## Delivered

### Core — `graph.ts`
- **Typed model:** `GraphNode` (researcher/institution/group/project/publication) and `GraphEdge` (`co_authored` / `affiliated` / `group_member` / `project_member`), each edge carrying a human-readable `label` (Spec §29).
- **`shortestPath`** — pure, tested BFS over a researcher-to-researcher adjacency; returns the ordered steps (each with its explaining edge) or null within `maxHops`. No I/O.
- **`buildResearcherEgoGraph`** — projects a researcher's neighbourhood from records: co-authors (via shared **public** publications), affiliated institutions, research groups, and projects. Every edge explains itself ("Co-authored …", "Affiliated with …").
- **`getNetworkSummary`** — collaborators / institutions / groups / projects / degree.
- **`getConnectionPath`** — "how are two researchers connected", via **structural ties only** (co-authorship, shared institution, shared group). Similarity (e.g. shared interests) is deliberately excluded — a connection must be a real link, not a resemblance. Returns the shortest such path, each hop explained.

### Web (`apps/web`)
- **`/researchers/[slug]/network`** — server-rendered radial **SVG ego-graph** (no client JS), colour-keyed legend, network summary cards, and grouped connection lists (collaborators/institutions/groups/projects). When a *different* signed-in researcher views it, a **"How you're connected"** path is shown with a reason per hop.
- Links from the researcher profile ("Research network →") and the dashboard ("My network").

## Validation results
- **Tests:** 81 passing (+6: `shortestPath` — direct/multi-hop/unreachable/disjoint, every step explained).
- **Type-check / Lint:** clean across all packages (sequential run).
- **Build:** the network route compiles.
- **Real-DB smoke:** 52/52 — a co-authored, researcher-attributed publication yields a **co-author edge derived from real records**, the co-author appears as a node, the network summary counts the collaborator, and the connection path links the pair at 1 hop with the reason `Co-authored "…"`.

## Integrity notes (Spec §21, §29)
- **Grounded by construction** — the graph is a projection of verified records; no node or edge exists without a backing relationship. Only public publications/projects contribute.
- **Every edge and every connection hop is explained.**
- Connection paths use real structural ties, not similarity, so "how you're connected" never overstates a link.

## Deferred (documented)
- Persisted/materialized graph + incremental updates (live projection is sufficient at current scale; adjacency is built per query).
- Interactive/force-directed client visualization (server-rendered SVG keeps it JS-free and accessible for now).
- Weighted edges (e.g. number of shared papers) and second-degree "people you may know" beyond the ego graph.
- Institution- and topic-level graphs building on the same typed model.

## Exit gate
A grounded research graph projected from verified records, a server-rendered network view, and explainable shortest-path connections between researchers; verified against a live database. **STOP FOR REVIEW.**
