import { describe, it, expect } from 'vitest';
import {
  summarizeScores,
  canManageInstitution,
  administeredInstitutionIds,
} from './institution-portal';
import type { Actor } from './rbac';

describe('summarizeScores', () => {
  it('returns null averages for an empty set (never fabricates a 0)', () => {
    expect(summarizeScores([])).toEqual({ count: 0, average: null, median: null });
  });

  it('computes average and median for an odd-sized set', () => {
    const s = summarizeScores([10, 20, 30]);
    expect(s).toEqual({ count: 3, average: 20, median: 20 });
  });

  it('computes the mean of the two middle values for an even-sized set', () => {
    const s = summarizeScores([10, 20, 30, 40]);
    expect(s.count).toBe(4);
    expect(s.average).toBe(25);
    expect(s.median).toBe(25);
  });

  it('ignores non-finite values', () => {
    const s = summarizeScores([10, NaN, 30, Infinity]);
    expect(s.count).toBe(2);
    expect(s.average).toBe(20);
  });
});

describe('institution management authorization (tenant isolation, Spec §49)', () => {
  const adminOfA: Actor = {
    userId: 'u1',
    roles: [{ role: 'institution_admin', scopeType: 'institution', scopeId: 'inst-A' }],
  };
  const plainResearcher: Actor = {
    userId: 'u2',
    roles: [{ role: 'researcher', scopeType: 'global', scopeId: null }],
  };
  const platformAdmin: Actor = {
    userId: 'u3',
    roles: [{ role: 'platform_admin', scopeType: 'global', scopeId: null }],
  };

  it('lets an institution admin manage their own institution', () => {
    expect(canManageInstitution(adminOfA, 'inst-A')).toBe(true);
  });

  it('forbids an institution admin from managing a DIFFERENT institution', () => {
    expect(canManageInstitution(adminOfA, 'inst-B')).toBe(false);
  });

  it('forbids a plain researcher from managing any institution', () => {
    expect(canManageInstitution(plainResearcher, 'inst-A')).toBe(false);
  });

  it('lets a global platform admin manage any institution', () => {
    expect(canManageInstitution(platformAdmin, 'inst-A')).toBe(true);
    expect(canManageInstitution(platformAdmin, 'inst-Z')).toBe(true);
  });

  it('lists only the institutions an actor actually administers', () => {
    const multi: Actor = {
      userId: 'u4',
      roles: [
        { role: 'institution_admin', scopeType: 'institution', scopeId: 'inst-A' },
        { role: 'department_admin', scopeType: 'institution', scopeId: 'inst-B' }, // no manage perm
      ],
    };
    expect(administeredInstitutionIds(multi)).toEqual(['inst-A']);
  });
});
