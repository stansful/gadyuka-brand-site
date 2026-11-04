/**
 * Admin sign-in (/api/v1/auth/*). Sessions are a short access token (HS512 JWT, sent as
 * `Authorization: Bearer …`) plus a rotating refresh token: every refresh returns a NEW pair and
 * the old refresh token stops working; presenting an already exchanged refresh token again ends
 * the whole session (stolen-token protection) — refresh once, then use the new pair.
 */

export type UserRole = 'ADMIN' | 'USER';

/** POST /auth/login (rate limited: 429 `throttled` with { minutes }). */
export interface AuthLoginRequest {
  readonly login: string;
  readonly password: string;
}

/** POST /auth/refresh */
export interface AuthRefreshRequest {
  readonly refreshToken: string;
}

/** POST /auth/logout → 204 (also for an unknown or expired token). */
export interface AuthLogoutRequest {
  readonly refreshToken: string;
}

/** Answer of POST /auth/login and POST /auth/refresh. Times are ISO 8601. */
export interface AuthTokensResponse {
  readonly tokenType: 'Bearer';
  readonly accessToken: string;
  readonly accessExpiresAt: string;
  readonly refreshToken: string;
  readonly refreshExpiresAt: string;
}

/** GET /auth/me */
export interface AuthMeResponse {
  readonly id: string;
  readonly login: string | null;
  readonly name: string;
  readonly role: UserRole;
  /** Id of the current session (the `sid` claim of the access token) */
  readonly sessionId: string;
}
