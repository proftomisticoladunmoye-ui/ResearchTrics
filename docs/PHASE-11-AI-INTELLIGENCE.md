# Phase 11 — AI Research Intelligence (Implementation Notes)

> **Status:** Implemented and validated (incl. real-DB smoke). Awaiting review.

Adds a provider-agnostic AI layer and the first **grounded, explained** research-intelligence features (Spec §29, §48, §64, §92).

## Design principles (non-negotiable)

- **Grounded, never hallucinated.** The AI is only ever handed verified platform records, and is instructed to use nothing else. It cannot invent a publication, citation, metric, or affiliation (Spec §29).
- **Provider-agnostic (Spec §48).** An `AIProvider` interface with two implementations. The default runs **entirely on-platform** with no external calls; Claude is a drop-in, config-gated alternative using the official Anthropic SDK.
- **Privacy by construction (Spec §92).** Only **public** records are assembled into AI context. The external provider additionally refuses to transmit anything flagged private. No private researcher data is sent to any provider.
- **Explained + trust-labelled (Spec §64).** Every output cites the source records it drew on, and the UI clearly marks it as an AI-generated *interpretation*, not a verified fact.

## Delivered

### `packages/ai` (new)
- **`AIProvider`** interface + `GroundedContext` / `GroundedFact` / `AIGeneration` types. A generation carries the `sources` (fact refs) it is grounded in and whether it was produced `external`ly.
- **`LocalProvider`** — the default. Deterministic, offline, on-platform: composes a grounded paragraph by restating the supplied facts in a stable order. It emits only the text assembled from real records, so it *cannot* hallucinate and no data leaves the platform. Works in air-gapped / no-key deployments with identical integrity guarantees.
- **`ClaudeProvider`** — config-gated (`AI_PROVIDER=claude` + `AI_API_KEY`). Official `@anthropic-ai/sdk`, `claude-opus-5`, adaptive thinking, low effort. A strict grounding system prompt forbids inventing publications/citations/metrics; refuses to transmit private data (Spec §92).
- **`createAIProvider(cfg)`** factory. Requesting `claude` without a key **falls back to local** (AI stays available, honestly labelled) and reports `fellBack`.

### `packages/core/ai-intelligence.ts`
- **`gatherRecords`** — assembles **public records only** (profile, affiliations, interests, public publications, output counts).
- **`buildFacts`** — turns records into self-contained factual clauses (the grounding set).
- **`extractExpertise`** — pure, tested, grounded: derives likely areas of expertise strictly from stated interests + publication titles, each term citing its evidence refs. Stopword-filtered; a title keyword is only introduced if it recurs.
- **`summarizeProfile` / `getResearcherIntelligence`** — resolve the configured provider and produce a grounded summary + expertise bundle for the dashboard.

### `packages/config`
- Added validated env: `AI_PROVIDER` (`local` default), `AI_API_KEY` (optional), `AI_MODEL` (`claude-opus-5`).

### Web (`apps/web`)
- **`/dashboard/insights`** — AI-generated profile summary + extracted expertise (with evidence counts) + the full **grounding set** ("Records this is grounded in"). Trust banner states the provider (on-platform vs external), record count, and the private-data guarantee. Linked from the dashboard header.

## Validation results
- **Tests:** 66 passing (+8 `LocalProvider`/factory, +6 `extractExpertise`).
- **Type-check / Lint:** clean across all packages (sequential run; parallel OOMs locally only).
- **Build:** insights route compiles.
- **Real-DB smoke:** on-platform provider is default; summary is grounded (mentions the real researcher); **every cited source is a provided record** (no fabrication); expertise surfaces the stated interest `psychometrics`, each term explained by evidence.

## Integrity notes (Spec §29, §48, §64, §92)
- Grounding set is shown in the UI and asserted in smoke — every claim is traceable to a record.
- Default provider makes zero external calls; Claude sends **public records only** and refuses private data.
- All AI output is labelled "AI-generated · grounded" and framed as an interpretation.

## Deferred (documented)
- Provider-side caching of Claude generations (deterministic local path needs none).
- Richer features (trend/gap discovery, journal/opportunity matching, related-literature) build on this same grounded contract in later phases.
- Streaming the Claude summary to the client (non-streaming is sufficient for a short summary).

## Exit gate
Provider-agnostic AI layer with an on-platform default; grounded, explained profile summary + expertise extraction; trust-labelled UI; verified against a live database. **STOP FOR REVIEW.**
