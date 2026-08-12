import type { RoleType, ScopeType } from '@researchtrics/db';

/**
 * RBAC with an ABAC seam (Spec §6, §49). `authorize()` receives resource
 * attributes (owner, tenant, visibility) so attribute rules can be layered
 * without changing call sites. Enforced server-side only — never trust client.
 */

export type Permission =
  | 'researcher:read'
  | 'researcher:update:self'
  | 'researcher:update:any'
  | 'researcher:verify'
  | 'institution:read'
  | 'institution:manage'
  | 'publication:create'
  | 'publication:update:any'
  | 'admin:access'
  | 'admin:rvm:configure'
  | 'admin:integrations:manage'
  | 'audit:read';

/** Role assignment carried on the authenticated actor. */
export interface RoleAssignment {
  role: RoleType;
  scopeType: ScopeType;
  scopeId?: string | null;
}

export interface Actor {
  userId: string;
  roles: RoleAssignment[];
}

export interface ResourceContext {
  /** Researcher/user id that owns the resource (for :self rules). */
  ownerUserId?: string | null;
  /** Institution tenant the resource belongs to (for tenant isolation). */
  tenantInstitutionId?: string | null;
}

/** Base permissions granted by each role (global capability layer). */
const ROLE_PERMISSIONS: Record<RoleType, Permission[]> = {
  researcher: ['researcher:read', 'researcher:update:self', 'institution:read'],
  student_researcher: ['researcher:read', 'researcher:update:self', 'institution:read'],
  research_assistant: ['researcher:read', 'researcher:update:self', 'institution:read'],
  research_group_admin: ['researcher:read', 'researcher:update:self', 'institution:read'],
  institution_admin: [
    'researcher:read',
    'institution:read',
    'institution:manage',
    'researcher:verify',
  ],
  department_admin: ['researcher:read', 'institution:read'],
  journal_editor: ['researcher:read', 'publication:create', 'institution:read'],
  publisher_admin: ['researcher:read', 'publication:create', 'publication:update:any'],
  reviewer: ['researcher:read'],
  research_administrator: ['researcher:read', 'institution:read', 'institution:manage'],
  funder: ['researcher:read', 'institution:read'],
  employer: ['researcher:read'],
  platform_admin: [
    'researcher:read',
    'researcher:update:any',
    'researcher:verify',
    'institution:read',
    'institution:manage',
    'publication:create',
    'publication:update:any',
    'admin:access',
    'admin:integrations:manage',
    'audit:read',
  ],
  super_admin: [
    'researcher:read',
    'researcher:update:any',
    'researcher:verify',
    'institution:read',
    'institution:manage',
    'publication:create',
    'publication:update:any',
    'admin:access',
    'admin:rvm:configure',
    'admin:integrations:manage',
    'audit:read',
  ],
};

function roleGrants(role: RoleType, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/**
 * Does a single role assignment grant `permission`, respecting tenant isolation
 * (Spec §49)? Global-scoped roles are unrestricted; a scoped role applies only
 * within its own tenant (and to tenant-less capability checks).
 */
function grantsWithScope(
  assignment: RoleAssignment,
  permission: Permission,
  resource: ResourceContext,
): boolean {
  if (!roleGrants(assignment.role, permission)) return false;
  if (assignment.scopeType === 'global') return true;
  if (
    assignment.scopeType === 'institution' &&
    resource.tenantInstitutionId != null &&
    assignment.scopeId === resource.tenantInstitutionId
  ) {
    return true;
  }
  // Scoped role checked against a resource with no tenant context: treat as a
  // plain capability check.
  return resource.tenantInstitutionId == null;
}

/**
 * Central authorization decision. Returns true only if some role grants the
 * permission AND tenant/ownership attribute rules are satisfied.
 */
export function authorize(
  actor: Actor,
  permission: Permission,
  resource: ResourceContext = {},
): boolean {
  const anyRoleGrants = (perm: Permission): boolean =>
    actor.roles.some((assignment) => grantsWithScope(assignment, perm, resource));

  // Ownership rule: a ":self" permission is satisfied either by holding the
  // broader ":any" variant, or by owning the resource and holding ":self".
  if (permission.endsWith(':self')) {
    const anyPermission = permission.replace(/:self$/, ':any') as Permission;
    if (anyRoleGrants(anyPermission)) return true;

    const ownsResource =
      resource.ownerUserId != null && resource.ownerUserId === actor.userId;
    return ownsResource && anyRoleGrants(permission);
  }

  return anyRoleGrants(permission);
}

/** Convenience: does the actor hold any admin-console access? */
export function isAdmin(actor: Actor): boolean {
  return authorize(actor, 'admin:access');
}
