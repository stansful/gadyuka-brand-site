import { NextResponse, type NextRequest } from 'next/server';

import { resolveAdminGate } from './admin-gate';
import { ADMIN_COOKIE_NAME, ADMIN_LOGIN_PATH } from './auth-constants';
import { deriveSessionKey, verifyAdminSession } from './session-token';

/**
 * Optimistic admin gate, run by src/proxy.ts for /admin/** page requests.
 *
 * - Open admin (ADMIN_PASSWORD empty in dev, or ADMIN_ALLOW_OPEN=1): everything passes.
 * - Password mode: a GET/HEAD (document load, RSC navigation or prefetch) without a valid
 *   session cookie gets a real 307 to /admin/login?next=<path> before anything renders.
 * - Locked (production without a usable ADMIN_PASSWORD — fail closed): every page GET is
 *   sent to /admin/login, which explains what to configure (no login form, no loop).
 *
 * This is NOT the security boundary: every page query, Server Action and Route Handler
 * re-checks access (src/lib/admin/auth.ts). POSTs (Server Actions) pass through untouched so
 * an expired session yields the action's own Russian error instead of a redirected POST.
 */
export async function adminProxyGate(request: NextRequest): Promise<NextResponse> {
  const gate = resolveAdminGate();
  if (gate.kind === 'open') return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  if (pathname === ADMIN_LOGIN_PATH || pathname.startsWith(`${ADMIN_LOGIN_PATH}/`)) return NextResponse.next();
  if (request.method !== 'GET' && request.method !== 'HEAD') return NextResponse.next();

  if (gate.kind === 'password') {
    const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value ?? '';
    const key = token ? await deriveSessionKey(gate.password, gate.sessionSecret) : null;
    if (key && (await verifyAdminSession(token, key))) return NextResponse.next();
  }

  const loginUrl = new URL(ADMIN_LOGIN_PATH, request.url);
  if (pathname !== '/admin') loginUrl.searchParams.set('next', `${pathname}${search}`);
  return NextResponse.redirect(loginUrl, 307);
}
