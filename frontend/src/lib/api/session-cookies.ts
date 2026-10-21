import type { AuthTokensResponse } from '@shared/contracts/auth';

/**
 * The admin session in the browser: two httpOnly cookies set from the backend's token pair
 * (POST /auth/login, /auth/refresh). JavaScript never sees them; the server reads them per request.
 *
 *   gadyuka_admin_access   the access JWT (sent to the backend as `Authorization: Bearer …`);
 *                          Max-Age = until accessExpiresAt (15 min), so an expired one is simply gone
 *   gadyuka_admin_refresh  the rotating refresh token; Max-Age = until refreshExpiresAt (30 days)
 *
 * Both: Path=/, SameSite=Lax, HttpOnly, Secure in production. No runtime imports: used by
 * src/proxy.ts (refresh) and the login / logout actions.
 */

export const ADMIN_ACCESS_COOKIE = 'gadyuka_admin_access';
export const ADMIN_REFRESH_COOKIE = 'gadyuka_admin_refresh';
export const ADMIN_LOGIN_PATH = '/admin/login';

/** Refresh this long before the access token expires (the request still has to reach the backend). */
export const ACCESS_TOKEN_EXPIRY_MARGIN_MS = 15_000;

export type SessionCookieOptions = {
  readonly httpOnly: true;
  readonly sameSite: 'lax';
  readonly secure: boolean;
  readonly path: '/';
  readonly maxAge: number;
};

export type SessionCookie = { readonly name: string; readonly value: string; readonly options: SessionCookieOptions };

/** The two cookies of a token pair (Max-Age from the backend's expiry times). */
export function sessionCookies(tokens: AuthTokensResponse, nowMs: number = Date.now()): SessionCookie[] {
  return [
    cookie(ADMIN_ACCESS_COOKIE, tokens.accessToken, secondsUntil(tokens.accessExpiresAt, nowMs)),
    cookie(ADMIN_REFRESH_COOKIE, tokens.refreshToken, secondsUntil(tokens.refreshExpiresAt, nowMs)),
  ];
}

/** Cookies that delete the session (logout, a refused refresh). */
export function expiredSessionCookies(): SessionCookie[] {
  return [cookie(ADMIN_ACCESS_COOKIE, '', 0), cookie(ADMIN_REFRESH_COOKIE, '', 0)];
}

/**
 * True while the access token can still be used: its `exp` claim is more than the margin away.
 * Only the claim is read — the signature is the backend's business (it checks it on every call).
 */
export function isAccessTokenFresh(token: string, nowMs: number = Date.now()): boolean {
  const expiresAt = accessTokenExpiry(token);
  return expiresAt !== null && expiresAt - ACCESS_TOKEN_EXPIRY_MARGIN_MS > nowMs;
}

/** `exp` of a JWT in milliseconds, or null for anything that is not a JWT with a numeric `exp`. */
export function accessTokenExpiry(token: string): number | null {
  const payload = token.split('.')[1];
  if (!payload) return null;
  try {
    const claims: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (typeof claims !== 'object' || claims === null || !('exp' in claims)) return null;
    return typeof claims.exp === 'number' ? claims.exp * 1000 : null;
  } catch {
    return null;
  }
}

/** A post-login target: only /admin paths, never the login page itself (no open redirects). */
export function safeAdminPath(value: unknown): string {
  if (typeof value !== 'string') return '/admin';
  if (!/^\/admin(?:[/?#]|$)/.test(value) || value.startsWith('//') || value.includes('\\')) return '/admin';
  return value.startsWith(ADMIN_LOGIN_PATH) ? '/admin' : value;
}

function cookie(name: string, value: string, maxAge: number): SessionCookie {
  return {
    name,
    value,
    options: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge },
  };
}

function secondsUntil(isoTime: string, nowMs: number): number {
  const expiresAt = Date.parse(isoTime);
  return Number.isNaN(expiresAt) ? 0 : Math.max(0, Math.floor((expiresAt - nowMs) / 1000));
}
