import { NextResponse, type NextRequest } from 'next/server';

import { refreshSession } from './auth';
import { RefreshSingleFlight, type RefreshOutcome } from './refresh-single-flight';
import {
  ADMIN_ACCESS_COOKIE,
  ADMIN_LOGIN_PATH,
  ADMIN_REFRESH_COOKIE,
  expiredSessionCookies,
  isAccessTokenFresh,
  sessionCookies,
  type SessionCookie,
} from './session-cookies';
import { isRefreshRefusal } from './session-refusals';

/**
 * POST /auth/refresh → an outcome: a refused token ends the session; any other failure (no answer, a
 * 5xx while the database is down, a mismatched internal key) keeps it — the token was not exchanged.
 */
async function refreshOutcome(refreshToken: string): Promise<RefreshOutcome> {
  const result = await refreshSession(refreshToken);
  if (result.ok) return { kind: 'refreshed', tokens: result.data };
  return isRefreshRefusal(result.failure) ? { kind: 'rejected' } : { kind: 'unavailable' };
}

/** One refresh per refresh token in this process (see RefreshSingleFlight). */
const singleFlight = new RefreshSingleFlight(refreshOutcome);

/**
 * The admin part of src/proxy.ts, for /admin/** (pages, RSC requests, Server Actions; not
 * /admin/api — uploads must not be buffered by the proxy). Optimistic: the security boundary is
 * requireAdmin* + the backend.
 *
 * 1. A fresh access cookie (by its `exp` claim) → pass.
 * 2. Otherwise, with a refresh cookie → refresh ONCE (single flight: concurrent and late requests with
 *    the same refresh token share the result for 30 s), then pass with the new cookies — set on the
 *    response for the browser AND on the forwarded request, so this very render already uses them.
 * 3. No usable session: a page GET (not the login page) → 307 /admin/login?next=<path>; anything else
 *    (Server Actions, the login page) passes and answers for itself. A refused refresh token also
 *    deletes the cookies; an unreachable backend keeps them (the next request tries again).
 */
export async function adminProxy(request: NextRequest, nowMs: number = Date.now()): Promise<NextResponse> {
  const accessToken = request.cookies.get(ADMIN_ACCESS_COOKIE)?.value;
  if (accessToken && isAccessTokenFresh(accessToken, nowMs)) return NextResponse.next();
  const refreshToken = request.cookies.get(ADMIN_REFRESH_COOKIE)?.value;
  const outcome: RefreshOutcome | null = refreshToken ? await singleFlight.run(refreshToken) : null;
  if (outcome?.kind === 'refreshed') return continueWith(request, sessionCookies(outcome.tokens, nowMs));
  if (outcome?.kind === 'unavailable') return NextResponse.next();
  const response = isRedirectable(request) ? redirectToLogin(request) : NextResponse.next();
  if (accessToken || refreshToken) setCookies(response, expiredSessionCookies());
  return response;
}

function continueWith(request: NextRequest, cookies: readonly SessionCookie[]): NextResponse {
  for (const cookie of cookies) request.cookies.set(cookie.name, cookie.value);
  const response = NextResponse.next({ request: { headers: request.headers } });
  setCookies(response, cookies);
  return response;
}

function setCookies(response: NextResponse, cookies: readonly SessionCookie[]): void {
  for (const cookie of cookies) response.cookies.set(cookie.name, cookie.value, cookie.options);
}

/** Page loads, RSC navigations and prefetches — not Server Actions (POST) and not the login page. */
function isRedirectable(request: NextRequest): boolean {
  const { pathname } = request.nextUrl;
  if (pathname === ADMIN_LOGIN_PATH || pathname.startsWith(`${ADMIN_LOGIN_PATH}/`)) return false;
  return request.method === 'GET' || request.method === 'HEAD';
}

function redirectToLogin(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;
  const loginUrl = new URL(ADMIN_LOGIN_PATH, request.url);
  if (pathname !== '/admin') loginUrl.searchParams.set('next', `${pathname}${search}`);
  return NextResponse.redirect(loginUrl, 307);
}
