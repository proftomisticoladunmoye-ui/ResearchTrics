import { describe, it, expect } from 'vitest';
import { scoreOpportunityMatch, canPostOpportunity, ingestOpportunities } from './opportunities';
import type { PrismaClient } from '@researchtrics/db';
import type { Actor } from './rbac';

describe('ingestOpportunities — resilience to unreachable sources', () => {
  it('skips (not throws) when a source is network-unreachable, without touching the DB', async () => {
    const unreachable = {
      name: 'wikicfp' as const,
      fetchOpportunities: async () => {
        const inner = Object.assign(new Error('connect EHOSTUNREACH 97.107.135.119:443'), {
          code: 'EHOSTUNREACH',
        });
        throw Object.assign(new TypeError('fetch failed'), { cause: inner });
      },
    };
    // A client that throws if used — proves we never reach the DB on skip.
    const client = new Proxy({}, { get() { throw new Error('DB should not be touched'); } }) as unknown as PrismaClient;
    const res = await ingestOpportunities(unreachable, {}, client);
    expect(res.skipped).toBe(true);
    expect(res.fetched).toBe(0);
    expect(res.created).toBe(0);
  });

  it('re-throws a non-network error (real bugs must surface)', async () => {
    const broken = {
      name: 'wikicfp' as const,
      fetchOpportunities: async () => {
        throw new Error('unexpected parse failure');
      },
    };
    const client = new Proxy({}, { get() { throw new Error('unused'); } }) as unknown as PrismaClient;
    await expect(ingestOpportunities(broken, {}, client)).rejects.toThrow('unexpected parse failure');
  });
});

describe('scoreOpportunityMatch (explainable, Spec §29)', () => {
  it('always explains a discipline match', () => {
    const r = scoreOpportunityMatch({ matchedDisciplines: ['psychometrics'] });
    expect(r.reasons.length).toBeGreaterThan(0);
    expect(r.reasons[0]).toContain('psychometrics');
    expect(r.score).toBeGreaterThan(0);
  });

  it('ranks more overlapping interests higher (with diminishing returns)', () => {
    const one = scoreOpportunityMatch({ matchedDisciplines: ['a'] });
    const three = scoreOpportunityMatch({ matchedDisciplines: ['a', 'b', 'c'] });
    expect(three.score).toBeGreaterThan(one.score);
    expect(three.score).toBeLessThanOrEqual(1);
  });

  it('adds an institution reason when the poster is the researcher’s institution', () => {
    const r = scoreOpportunityMatch({
      matchedDisciplines: [],
      sameInstitution: true,
      institutionName: 'Test University',
    });
    expect(r.reasons.some((x) => x.includes('Test University'))).toBe(true);
  });

  it('mentions an imminent deadline but only as a secondary reason', () => {
    const r = scoreOpportunityMatch({ matchedDisciplines: ['x'], daysToDeadline: 3 });
    expect(r.reasons.some((x) => x.toLowerCase().includes('deadline'))).toBe(true);
  });

  it('produces no reasons when there is no signal at all', () => {
    const r = scoreOpportunityMatch({ matchedDisciplines: [] });
    expect(r.reasons).toEqual([]);
    expect(r.score).toBe(0);
  });

  it('caps the score at 1', () => {
    const r = scoreOpportunityMatch({
      matchedDisciplines: ['a', 'b', 'c', 'd', 'e'],
      sameInstitution: true,
      daysToDeadline: 1,
    });
    expect(r.score).toBeLessThanOrEqual(1);
  });
});

describe('opportunity posting authorization', () => {
  const mk = (role: Actor['roles'][number]['role']): Actor => ({
    userId: 'u',
    roles: [{ role, scopeType: 'global', scopeId: null }],
  });

  it('allows funders, employers, research administrators, and admins to post', () => {
    for (const role of ['funder', 'employer', 'research_administrator', 'platform_admin'] as const) {
      expect(canPostOpportunity(mk(role))).toBe(true);
    }
  });

  it('forbids a plain researcher from posting opportunities', () => {
    expect(canPostOpportunity(mk('researcher'))).toBe(false);
  });
});
