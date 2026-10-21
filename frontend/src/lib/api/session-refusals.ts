import type { ApiErrorCode } from '@shared/contracts/errors';

import type { ApiFailure } from './api-result';

/**
 * Which failures of the session routes mean "this session is over" — and which only mean the
 * backend could not say. Only the refusals below end a session (null admin, deleted cookies); any
 * other answer is an outage and is reported as one: a 5xx (database down), a 429, the 401
 * `internalKeyRequired` of a mismatched INTERNAL_API_KEY (a configuration error, not a logout), a
 * proxy's error page, no answer at all.
 */

/** GET /auth/me (and the guarded routes): no / malformed / expired / revoked access token, or a role that has no access. */
const ACCESS_REFUSALS: ReadonlySet<ApiErrorCode> = new Set(['unauthorized', 'accessTokenInvalid', 'forbidden']);

/** POST /auth/refresh: the refresh token is unknown, expired, revoked or was already exchanged. */
const REFRESH_REFUSALS: ReadonlySet<ApiErrorCode> = new Set(['refreshTokenInvalid', 'refreshTokenReused']);

const UNAUTHORIZED_STATUS = 401;
const FORBIDDEN_STATUS = 403;

/** The access token does not (or no longer) sign anyone in. */
export function isAccessRefusal(failure: ApiFailure): boolean {
  return failure.kind === 'domain' && isAuthStatus(failure.status) && ACCESS_REFUSALS.has(failure.error);
}

/** The refresh token cannot be exchanged any more (a malformed one is refused by validation). */
export function isRefreshRefusal(failure: ApiFailure): boolean {
  if (failure.kind === 'validation') return true;
  return failure.kind === 'domain' && isAuthStatus(failure.status) && REFRESH_REFUSALS.has(failure.error);
}

function isAuthStatus(status: number): boolean {
  return status === UNAUTHORIZED_STATUS || status === FORBIDDEN_STATUS;
}
