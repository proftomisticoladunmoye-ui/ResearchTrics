import { describe, it, expect } from 'vitest';
import { extractExpertise } from './ai-intelligence';

describe('extractExpertise (grounded, Spec §29)', () => {
  it('surfaces stated interests as top expertise, cited to the interests record', () => {
    const terms = extractExpertise({
      interests: ['psychometrics', 'measurement invariance'],
      titles: [],
    });
    const psy = terms.find((t) => t.term === 'psychometrics');
    expect(psy).toBeDefined();
    expect(psy!.evidence).toContain('interests');
    // With no titles, interests still rank first.
    expect(terms[0]!.evidence).toContain('interests');
  });

  it('reinforces an interest that also appears in publication titles', () => {
    const terms = extractExpertise({
      interests: ['invariance'],
      titles: [
        { ref: 'RTP-1', title: 'Measurement invariance across cultures' },
        { ref: 'RTP-2', title: 'Testing invariance in longitudinal data' },
      ],
    });
    const inv = terms.find((t) => t.term === 'invariance')!;
    // Interest (3) + reinforced by two titles (2 each) → strongest, cited to all three.
    expect(inv.weight).toBeGreaterThanOrEqual(7);
    expect(inv.evidence).toEqual(['RTP-1', 'RTP-2', 'interests']);
  });

  it('introduces a title keyword only when it recurs across titles', () => {
    const terms = extractExpertise({
      interests: [],
      titles: [
        { ref: 'RTP-1', title: 'Resilience and coping in adolescents' },
        { ref: 'RTP-2', title: 'Resilience among clinicians' },
        { ref: 'RTP-3', title: 'Attention and memory' },
      ],
    });
    // "resilience" appears in two titles → included; "adolescents" once → dropped.
    expect(terms.map((t) => t.term)).toContain('resilience');
    expect(terms.map((t) => t.term)).not.toContain('adolescents');
  });

  it('never invents a term that is not in the records', () => {
    const terms = extractExpertise({
      interests: ['bibliometrics'],
      titles: [{ ref: 'RTP-1', title: 'Citation patterns in open science' }],
    });
    for (const t of terms) {
      const grounded =
        t.evidence.includes('interests') || t.evidence.some((e) => e.startsWith('RTP-'));
      expect(grounded).toBe(true);
    }
  });

  it('filters stopwords and short words out of title keywords', () => {
    const terms = extractExpertise({
      interests: [],
      titles: [
        { ref: 'RTP-1', title: 'A study of the new approach' },
        { ref: 'RTP-2', title: 'A study of the new method' },
      ],
    });
    // "study", "the", "new", "approach" are stopwords/one-off; nothing meaningful recurs.
    expect(terms.map((t) => t.term)).not.toContain('study');
    expect(terms.map((t) => t.term)).not.toContain('the');
  });

  it('is deterministic', () => {
    const input = {
      interests: ['a-topic', 'b-topic'],
      titles: [{ ref: 'RTP-1', title: 'A-topic and b-topic together' }],
    };
    expect(extractExpertise(input)).toEqual(extractExpertise(input));
  });
});
