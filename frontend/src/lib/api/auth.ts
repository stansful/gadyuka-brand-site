import type { AuthLoginRequest, AuthMeResponse, AuthTokensResponse } from '@shared/contracts/auth';

import type { ApiResult } from './api-result';

import { apiRequest, type VisitorInfo } from './client';

/**
 * The backend's session routes (/api/v1/auth/*). No request-time APIs: callers pass the visitor
 * and tokens (the login / logout actions, src/proxy.ts for the refresh, ./admin.ts for /auth/me).
 */

/** POST /auth/login — 401 invalidCredentials, 429 throttled { minutes }, 400 validation. */
export function signIn(credentials: AuthLoginRequest, visitor: VisitorInfo): Promise<ApiResult<AuthTokensResponse>> {
  return apiRequest<AuthTokensResponse>('/api/v1/auth/login', { method: 'POST', body: credentials, visitor });
}

/**
 * POST /auth/refresh — a NEW pair; the given token is spent. Presenting it again revokes the whole
 * session, so call this only through the proxy's single flight (src/lib/api/refresh-single-flight.ts).
 */
export function refreshSession(refreshToken: string): Promise<ApiResult<AuthTokensResponse>> {
  return apiRequest<AuthTokensResponse>('/api/v1/auth/refresh', { method: 'POST', body: { refreshToken } });
}

/** POST /auth/logout — 204, also for an unknown or expired token. */
export function signOut(refreshToken: string): Promise<ApiResult<void>> {
  return apiRequest<void>('/api/v1/auth/logout', { method: 'POST', body: { refreshToken } });
}

/** GET /auth/me — the signed-in user (401 when the token is missing, expired or its session revoked). */
export function fetchCurrentUser(accessToken: string): Promise<ApiResult<AuthMeResponse>> {
  return apiRequest<AuthMeResponse>('/api/v1/auth/me', { accessToken });
}
