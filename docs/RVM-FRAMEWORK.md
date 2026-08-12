# ResearchTrics — RVM Framework

> **Status:** Phase 0 — *Draft for review*
> **RVM = Research Visibility Metric.** A configurable, transparent measurement framework — **not** an arbitrary score (Spec §23).

> **Integrity label (Spec §24):** RVM is presented as *"ResearchTrics proprietary research visibility framework"* and is **not** described as psychometrically validated until empirical validation is complete. Weights below are **provisional defaults**, not scientific claims.

---

## 1. What RVM is — and is not

| RVM **is** | RVM is **not** |
|---|---|
| A measure of research **visibility** — how discoverable, accessible, and connected a body of work is | A measure of research **quality** |
| Transparent: every input, normalization, weight, and gap is inspectable | A black-box or vanity number |
| Configurable and versioned | A fixed formula with hidden weights |
| Contextualized by career stage and (future) discipline | A cross-discipline raw comparison |

**Core separation (Spec §23):** RVM must never imply that high visibility = high impact = high quality. These are represented as **distinct** constructs; visibility is what RVM measures.

---

## 2. The ten dimensions (Spec §23)

| # | Dimension | Question it answers | Example indicators (illustrative) |
|---|---|---|---|
| 1 | **Discoverability** | Can the work be found? | Indexable public pages, complete metadata, DOI presence, sitemap inclusion, search appearances |
| 2 | **Accessibility** | Can it be read/obtained? | Open-access status, full-text availability (licensed), abstract openness |
| 3 | **Scholarly Engagement** | Is it being interacted with? | Bot-filtered views, downloads, saves, follows |
| 4 | **Citation Influence** | Is it being cited? | Source-labelled citation counts (Crossref/OpenAlex…), citation trend |
| 5 | **Collaboration Reach** | How broad is the co-author network? | Distinct collaborators, institutions, cross-group ties |
| 6 | **Research Connectivity** | How linked is the work in the graph? | Links to datasets, instruments, software, projects, funders |
| 7 | **Open Science** | How open are the practices? | Open licenses, open data/instruments/code, preprints |
| 8 | **Knowledge Translation** | Reach beyond academia? | Policy briefs, non-academic outputs, translations |
| 9 | **International Reach** | How geographically broad? | Country diversity of collaborators/affiliations/audience |
| 10 | **Digital Scholarly Presence** | Connected scholarly identity? | ORCID, linked external IDs, profile completeness, institutional profile |

*Indicators are illustrative and will be refined with review; all live in the configurable `rvm_indicators` registry.*

---

## 3. Scoring engine (configurable & transparent)

### 3.1 Pipeline

```
raw indicator values (from metrics, citations, files, graph, provenance)
   → per-indicator normalization (bounded 0..1, method recorded)
   → indicator weight (configurable, versioned)
   → dimension aggregation (weighted) → dimension score 0..100
   → dimension weight (configurable) → overall RVM 0..100
   → attach: raw values, normalized values, weights, missing-data map, confidence, calc date
```

### 3.2 Transparency contract (Spec §23, §25)

Every `rvm_scores` row exposes, for both overall and each dimension:

- **raw values** per indicator
- **normalized values** and the normalization method used
- **weighting** applied (indicator + dimension)
- **missing data** map (which indicators had no data)
- **confidence** (function of data completeness + source quality)
- **calculation date** and **framework version**

A researcher can always answer *"why is my score what it is, and what would move it?"*

### 3.3 Data model (see [`DATABASE-ARCHITECTURE.md`](./DATABASE-ARCHITECTURE.md))

- `rvm_indicators` — key, dimension, formula reference, normalization, weight, active version.
- `rvm_dimensions` — key, name, weight, active version.
- `rvm_scores` — subject (researcher/institution/group), version, overall, dimensions JSONB, indicators JSONB, confidence, missing-data JSONB, calculated_at.

Weights and normalization are **data, not code** — configurable via admin RVM config (Spec §37) and versioned so historical scores remain reproducible.

---

## 4. Normalization & fairness (Spec §87–89)

RVM must avoid citation manipulation, prestige/country/language/institution bias, career-stage discrimination, and field-size distortion (Spec §87).

- **Career-stage context (Spec §88):** comparisons contextualized by stage (undergraduate → professor). Never compare an early-career researcher's raw counts to a senior's as equivalent.
- **Field normalization (future, Spec §89):** field-normalized citation impact, publication-age normalization, disciplinary publishing-pattern adjustment. **Not** in the prototype; the engine's normalization layer is designed to accept these later.
- **No cross-discipline raw comparison** is surfaced without qualification (Spec §89).

The prototype computes and *displays* dimensions with provisional weights but labels comparisons carefully and omits any ranking whose methodology isn't defensible (Spec §26).

---

## 5. Anti-gaming (Spec §23, §65)

RVM inputs are protected so the metric can't be inflated:

- **Bot filtering** on views/downloads before they count (Spec §41); `metrics.bot_filtered` flag.
- **Rate limiting** on engagement events.
- **Anomaly detection** on spikes (self-clicks, duplicated IP/device patterns where lawful, citation manipulation, automated activity).
- **Legitimate high-volume activity is never auto-punished** (Spec §65) — anomalies flag for review, not automatic penalty.
- Citation counts are **source-labelled and never merged** (Spec §33), so no provider's number can be double-counted.

---

## 6. RVM dashboard (Spec §25)

**Researcher view:**

- **Overall RVM** (gold-accented headline metric — the sanctioned premium use of gold, Spec §3).
- Per-dimension scores: Discoverability, Accessibility, Engagement, Citation Influence, Collaboration, Open Science, Knowledge Translation, International Reach, Digital Presence.
- **Trends:** last 30 / 90 / 365 days / all time, each showing current · previous · change · % change (from `metric_snapshots`).
- **"Improve My Visibility"** (Spec §30): prioritized, *explained* recommendations (add ORCID, add DOIs/abstracts/keywords, link datasets/instruments, upload licensed full text, complete bio, connect identifiers…). Recommendations are actionable and ranked by expected effect — never unexplained (Spec §29).
- **Profile completeness %** (Spec §31) with an explicit missing-items list, without unfair penalization.

**Institutional view (Spec §26):** institutional RVM plus department comparisons, using only defensible methodology; no rankings otherwise.

---

## 7. Psychometric development module (Spec §24)

A **separate methodology module** is architected so RVM can eventually be empirically validated — *without* asserting validity prematurely.

Future analyses supported (design-only now): reliability, EFA, CFA, convergent/discriminant/criterion/predictive validity, measurement invariance, longitudinal stability.

Until validation:

- RVM is labelled **proprietary framework, pending validation**.
- No psychometric claims are hard-coded (Spec §24).
- The framework is versioned so a validated model can supersede the prototype with historical reproducibility intact.

---

## 8. Trust labelling in the product (Spec §64)

Wherever RVM appears, the UI distinguishes:

- **Platform-computed metric** (RVM itself) — clearly labelled as such.
- **External metadata** (e.g., OpenAlex citation counts feeding an indicator) — source-labelled.
- **Researcher-provided information** — labelled.
- **AI-generated interpretation** (e.g., an explanation of what drives a score) — labelled and grounded in source records (Spec §29).

---

## 9. Phase stance

- **Phase 10** builds the RVM data model, indicator engine, dimension scoring, transparency surfacing, researcher dashboard, and institutional RVM — but **does not finalize weights without methodological review** (Spec §10, §23).
- A **prototype RVM** is part of the MVP (Spec §78) — functional, transparent, provisional.
- Weight finalization and psychometric validation are explicitly **post-MVP**.

---

*All weights, indicators, and normalization methods in this document are provisional and pending review. Nothing here asserts empirical validity.*
