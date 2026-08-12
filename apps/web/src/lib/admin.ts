import { redirect } from 'next/navigation';
import { isAdmin } from '@researchtrics/core';
import { getCurrentUser, type CurrentUser } from './current-user';

/** Server guard for admin pages (Spec §37). Redirects non-admins. */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!isAdmin(user.actor)) redirect('/');
  return user;
}
