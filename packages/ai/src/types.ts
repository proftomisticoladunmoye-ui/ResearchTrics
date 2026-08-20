/**
 * AI provider abstraction for ResearchTrics (Spec §29, §48, §92).
 *
 * Every AI feature in ResearchTrics is *grounded*: a provider may only draw on
 * the verified platform records it is handed, and must never invent
 * publications, citations, metrics, affiliations, or dates. The design is
 * provider-agnostic (Spec §48) — the default provider runs entirely on-platform
 * with no external calls, and Claude is a drop-in, config-gated alternative.
 */

/** A single verified fact drawn verbatim from a platform record. */
export interface GroundedFact {
  /**
   * Stable reference to the source record — an RTX/RTP/RTJ id, or a synthetic
   * key such as `interest:psychometrics`. This is what a generation cites, so
   * every claim can be traced back to a record (Spec §29).
   */
  ref: string;
  /** Category: `profile` | `interest` | `affiliation` | `publication` | `output` | `metric`. */
  kind: string;
  /** The fact, phrased as a self-contained clause. Only these may be used. */
  text: string;
}

/**
 * Generation mode.
 * - `summary`: strict, facts-only restatement of verified records. The provider
 *   may use nothing beyond `facts` and must not add prose of its own (Spec §29).
 * - `assist`: writing help. The provider drafts/edits/brainstorms from the
 *   author's own supplied `material`, and may compose original prose — but it
 *   must never fabricate data, results, citations, references, or metrics. It is
 *   an aid to the author's writing, not a source of facts (never-fabricate rule).
 */
export type GenerationMode = 'summary' | 'assist';

/** Everything a provider is permitted to see and use for one generation. */
export interface GroundedContext {
  /** Machine task key, e.g. `profile-summary` or `assist:abstract`. */
  task: string;
  /** Generation mode. Defaults to `summary` when omitted. */
  mode?: GenerationMode;
  /** What to produce, in plain language. */
  instruction: string;
  /**
   * The complete set of facts the provider may use. A provider MUST NOT
   * introduce any claim not supported by these facts.
   */
  facts: GroundedFact[];
  /**
   * Assist mode only: the author's own material to work from (their draft
   * paragraph, title, key points, abstract…). Provided by the signed-in author
   * about their own work; the provider treats it as the author's content to
   * refine, never as a claim to verify.
   */
  material?: string;
  /**
   * Assist mode only: allow the provider to browse the web for real, current
   * sources and cite them (grounding, not fabrication). Supported by gateways
   * with a web plugin (OpenRouter); ignored otherwise.
   */
  web?: boolean;
  /** Upper bound on output length; providers pick a sensible default otherwise. */
  maxTokens?: number;
  /**
   * True if `facts` include any non-public researcher data. External providers
   * must refuse to transmit private data without explicit authorization
   * (Spec §92). ResearchTrics only ever assembles public facts, so this is a
   * defence-in-depth guard rather than a routine path.
   */
  containsPrivate?: boolean;
}

/** The result of a grounded generation. */
export interface AIGeneration {
  /** The generated text. */
  text: string;
  /** Provider + model, e.g. `local` or `claude:claude-opus-5`. */
  model: string;
  /** Always true — this system only produces grounded output. */
  grounded: true;
  /** Refs of the source facts the output is grounded in (subset of the context). */
  sources: string[];
  /** True when the generation was produced by an external service. */
  external: boolean;
}

/** A pluggable generation backend (Spec §48). */
export interface AIProvider {
  /** Short provider name, surfaced in trust labelling. */
  readonly name: string;
  /** True when this provider transmits context to a third-party service. */
  readonly external: boolean;
  /** Produce a grounded generation from the supplied context. */
  generateGrounded(ctx: GroundedContext): Promise<AIGeneration>;
}
