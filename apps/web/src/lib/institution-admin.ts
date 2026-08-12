import { redirect } from 'next/navigation';
import { canManageInstitution } from '@researchtrics/core';
import { getCurrentUser, type CurrentUser } from './current-user';

/**
 * Server guard for institution-admin pages (Spec §49). Redirects anyone who
 * does not hold institution-management rights for THIS institution — tenant
 * isolation is enforced by `canManageInstitution`.
 */
export async function requireInstitutionAdmin(institutionId: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!canManageInstitution(user.actor, institutionId)) redirect('/');
  return user;
}
