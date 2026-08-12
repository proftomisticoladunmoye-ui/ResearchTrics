import { describe, it, expect } from 'vitest';
import { authorize, isAdmin, type Actor } from './rbac';

const researcher: Actor = {
  userId: 'user-1',
  roles: [{ role: 'researcher', scopeType: 'global' }],
};

const instAdmin: Actor = {
  userId: 'admin-1',
  roles: [{ role: 'institution_admin', scopeType: 'institution', scopeId: 'inst-A' }],
};

const superAdmin: Actor = {
  userId: 'root',
  roles: [{ role: 'super_admin', scopeType: 'global' }],
};

describe('authorize — ownership (:self)', () => {
  it('allows a researcher to update their own profile', () => {
    expect(
      authorize(researcher, 'researcher:update:self', { ownerUserId: 'user-1' }),
    ).toBe(true);
  });

  it('denies a researcher updating someone else without :any', () => {
    expect(
      authorize(researcher, 'researcher:update:self', { ownerUserId: 'user-2' }),
    ).toBe(false);
  });

  it('allows super_admin to update any profile via :any', () => {
    expect(
      authorize(superAdmin, 'researcher:update:self', { ownerUserId: 'user-2' }),
    ).toBe(true);
  });
});

describe('authorize — tenant isolation (Spec §49)', () => {
  it('allows institution_admin to manage their own institution', () => {
    expect(
      authorize(instAdmin, 'institution:manage', { tenantInstitutionId: 'inst-A' }),
    ).toBe(true);
  });

  it('denies institution_admin managing a different institution', () => {
    expect(
      authorize(instAdmin, 'institution:manage', { tenantInstitutionId: 'inst-B' }),
    ).toBe(false);
  });
});

describe('authorize — plain capability', () => {
  it('grants admin console only to admins', () => {
    expect(isAdmin(researcher)).toBe(false);
    expect(isAdmin(superAdmin)).toBe(true);
  });

  it('denies a permission a role does not hold', () => {
    expect(authorize(researcher, 'admin:rvm:configure')).toBe(false);
  });
});
