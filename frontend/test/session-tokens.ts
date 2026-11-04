import type { AuthTokensResponse } from '@shared/contracts/auth';

/** An unsigned JWT with the given expiry (ms): the frontend only ever reads the `exp` claim. */
export function jwtExpiringAt(expMs: number, subject = 'user'): string {
  const part = (value: object): string => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${part({ alg: 'HS512', typ: 'JWT' })}.${part({ sub: subject, exp: Math.floor(expMs / 1000) })}.signature`;
}

/** A token pair as POST /auth/login answers it at `nowMs` (access 15 min, refresh 30 days). */
export function testTokens(nowMs: number, refreshToken = 'session-id.secret'): AuthTokensResponse {
  return {
    tokenType: 'Bearer',
    accessToken: jwtExpiringAt(nowMs + 15 * 60_000),
    accessExpiresAt: new Date(nowMs + 15 * 60_000).toISOString(),
    refreshToken,
    refreshExpiresAt: new Date(nowMs + 30 * 86_400_000).toISOString(),
  };
}
