import 'server-only';
import { cookies } from 'next/headers';
import { cache } from 'react';

import type { AuthMeResponse } from '@shared/contracts/auth';

import { ApiRequestError, type ApiResult } from './api-result';
import { fetchCurrentUser } from './auth';
import { apiRequest, type ApiPath, type ApiRequestOptions } from './client';
import { ADMIN_ACCESS_COOKIE } from './session-cookies';
import { isAccessRefusal } from './session-refusals';
import { getVisitor } from './visitor';

/**
 * Backend calls of the admin (server-only, request-time: they read the session cookie).
 *
 *   const result = await adminRequest<CollectionDetails>(`/api/v1/admin/collections/${id}`);
 *
 * The access cookie is kept fresh by src/proxy.ts (refresh once, before the page / action runs), so
 * this only reads it. No cookie → the same 401 failure the backend answers to an expired token.
 */
export async function adminRequest<T>(
  path: ApiPath,
  options: Omit<ApiRequestOptions, 'accessToken' | 'visitor'> = {},
): Promise<ApiResult<T>> {
  const accessToken = await getAccessToken();
  if (!accessToken) return { ok: false, failure: SESSION_REQUIRED };
  return apiRequest<T>(path, { ...options, accessToken, visitor: await getVisitor() });
}

/** The access token of the current request ('' when there is none). */
export async function getAccessToken(): Promise<string> {
  return (await cookies()).get(ADMIN_ACCESS_COOKIE)?.value ?? '';
}

/**
 * The signed-in admin of the current request — GET /auth/me with the access cookie, once per
 * request (React cache). The backend checks signature, expiry, that the session is not revoked and
 * the role, so a logout or a revoked session ends access at once. Null = not signed in (no cookie, a
 * refused token — ./session-refusals.ts — or a non-ADMIN user). Anything else throws ApiRequestError:
 * an outage (no answer, a 5xx such as a database down) or a mismatched INTERNAL_API_KEY is not a
 * logout — pages show the admin error page (src/app/admin/error.tsx), the login page its notice.
 */
export const getAdminSession = cache(async (): Promise<AuthMeResponse | null> => {
  const accessToken = await getAccessToken();
  if (!accessToken) return null;
  const result = await fetchCurrentUser(accessToken);
  if (result.ok) return result.data.role === 'ADMIN' ? result.data : null;
  if (isAccessRefusal(result.failure)) return null;
  throw new ApiRequestError('/api/v1/auth/me', result.failure);
});

const SESSION_REQUIRED = {
  kind: 'domain',
  status: 401,
  error: 'unauthorized',
  message: { key: 'admin.auth.sessionRequired' },
} as const;
