/** Session cookie contract (Spec §35). HttpOnly, SameSite=Lax, Secure in prod. */

export const SESSION_COOKIE = 'rt_session';

export interface CookieOptions {
  httpOnly: true;
  sameSite: 'lax';
  secure: boolean;
  path: string;
  expires?: Date;
  maxAge?: number;
}

export function sessionCookieOptions(expires?: Date): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    ...(expires ? { expires } : {}),
  };
}

export function clearedSessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  };
}
