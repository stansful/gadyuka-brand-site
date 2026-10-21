import 'server-only';
import { redirect } from 'next/navigation';

import { getAdminSession } from '@/lib/api/admin';
import { ApiRequestError } from '@/lib/api/api-result';
import { ADMIN_LOGIN_PATH } from '@/lib/api/session-cookies';
import type { AuthMeResponse } from '@shared/contracts/auth';

import { getAdminTranslations } from './i18n-server';

/**
 * Admin access control of the frontend. Every admin route needs a signed-in ADMIN (owner's
 * decision: no open admin). The session lives in the backend; this server keeps the access /
 * refresh tokens in httpOnly cookies (src/lib/api/session-cookies.ts):
 *
 * - src/proxy.ts (optimistic, before anything renders): reads only the `exp` claim of the access
 *   cookie; expired → refreshes ONCE (POST /auth/refresh, single flight) and sets the new cookies;
 *   no usable session → 307 to /admin/login?next=… for page GETs (actions / API get their own 401).
 * - the checks below (the security boundary, per request): GET /auth/me with the access cookie —
 *   the backend verifies signature, expiry, the session (logout / reuse revokes at once) and the
 *   role. One call per request (React cache in getAdminSession).
 * - and the backend itself checks the token and the ADMIN role on every /admin/* call.
 *
 * Enforcement points (never rely on the layout alone — pages render in parallel with layouts and
 * Server Actions / Route Handlers are reachable by direct POST):
 *   requireAdminPage()    — admin layout + every admin data query
 *   Server Actions        — the backend checks the session on every call they make (adminRequest
 *                           sends the access cookie; a 401 becomes «Сессия истекла…», src/lib/api/admin-action.ts)
 *   requireAdminRoute()   — every admin Route Handler (src/app/admin/api/**)
 */

export { ADMIN_LOGIN_PATH };

export type AdminSession = AuthMeResponse;

/** Pages / layouts / data queries: redirects to the login page when there is no admin session. */
export async function requireAdminPage(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) redirect(ADMIN_LOGIN_PATH);
  return session;
}

/**
 * What the login page knows about the session: signed in (→ straight to the admin), signed out (→ the
 * form), or unknown — the backend could not check it (down, 5xx, misconfigured): the form still shows,
 * with a notice, instead of the page failing as a whole.
 */
export type LoginSessionState = 'signedIn' | 'signedOut' | 'unavailable';

export async function getLoginSessionState(): Promise<LoginSessionState> {
  try {
    return (await getAdminSession()) ? 'signedIn' : 'signedOut';
  } catch (error: unknown) {
    if (!(error instanceof ApiRequestError)) throw error;
    console.error(`[admin] login page: ${error.message}`);
    return 'unavailable';
  }
}

/**
 * Route Handlers: returns an error Response (403 cross-site, 401 no session) or null when allowed.
 *   const denied = await requireAdminRoute(request); if (denied) return denied;
 */
export async function requireAdminRoute(request: Request): Promise<Response | null> {
  if (request.method !== 'GET' && request.method !== 'HEAD' && !isSameOriginRequest(request)) {
    const t = await getAdminTranslations('admin.auth');
    return Response.json({ error: t('crossSite') }, { status: 403 });
  }
  if (!(await getAdminSession())) {
    const t = await getAdminTranslations('admin.auth');
    return Response.json({ error: t('sessionRequired') }, { status: 401 });
  }
  return null;
}

/** CSRF guard for mutating Route Handlers (Server Actions have their own Origin check). */
export function isSameOriginRequest(request: Request): boolean {
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') return false;
  const origin = request.headers.get('origin');
  if (!origin) return true;
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  if (!host) return false;
  try {
    return new URL(origin).host === host.split(',')[0]?.trim();
  } catch {
    return false;
  }
}
