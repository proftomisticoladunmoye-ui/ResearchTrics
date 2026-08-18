import type { AIProvider, AIGeneration, GroundedContext } from './types';

/**
 * The default provider — fully on-platform, deterministic, and offline.
 *
 * It composes a grounded generation by restating the supplied facts, in a
 * stable order, as a single factual paragraph. Because it only ever emits the
 * `text` the caller assembled from real records, it *cannot* hallucinate a
 * publication or a metric, and no researcher data ever leaves the platform
 * (Spec §29, §92). This makes AI features work everywhere — including
 * air-gapped and no-key deployments — with the same integrity guarantees as
 * the Claude provider.
 */
export class LocalProvider implements AIProvider {
  readonly name = 'local';
  readonly external = false;

  // Ordering that reads naturally as a profile paragraph.
  private static readonly KIND_ORDER = [
    'profile',
    'affiliation',
    'interest',
    'publication',
    'output',
    'metric',
  ];

  generateGrounded(ctx: GroundedContext): Promise<AIGeneration> {
    // Assist mode: the on-platform provider cannot compose original prose, so it
    // returns the author's own material unchanged (never fabricating anything).
    // Rich drafting is delivered by a configured external provider; callers that
    // want structured offline help build it deterministically themselves.
    if ((ctx.mode ?? 'summary') === 'assist') {
      const text = (ctx.material ?? '').trim();
      return Promise.resolve({
        text,
        model: 'local',
        grounded: true,
        sources: ctx.facts.map((f) => f.ref),
        external: false,
      });
    }

    const rank = (kind: string) => {
      const i = LocalProvider.KIND_ORDER.indexOf(kind);
      return i === -1 ? LocalProvider.KIND_ORDER.length : i;
    };

    const ordered = [...ctx.facts]
      .map((f, i) => ({ f, i }))
      .sort((a, b) => rank(a.f.kind) - rank(b.f.kind) || a.i - b.i)
      .map(({ f }) => f);

    const seen = new Set<string>();
    const sentences: string[] = [];
    const sources: string[] = [];
    for (const fact of ordered) {
      const text = fact.text.trim();
      if (!text || seen.has(text)) continue;
      seen.add(text);
      sentences.push(/[.!?]$/.test(text) ? text : `${text}.`);
      sources.push(fact.ref);
    }

    const text = sentences.join(' ');
    return Promise.resolve({
      text,
      model: 'local',
      grounded: true,
      sources,
      external: false,
    });
  }
}
