import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthMeResponse } from '@shared/contracts/auth';

import { ApiRequestError, type ApiFailure, type ApiResult } from './api-result';

/**
 * getAdminSession: which answers of GET /auth/me mean «not signed in» (null → the login page) and
 * which are an outage that must not look like a logout (throws → the admin error page).
 */

let accessCookie: string | undefined = 'access-jwt';
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => (accessCookie === undefined ? undefined : { value: accessCookie }) }),
}));
const fetchCurrentUser = vi.fn<(token: string) => Promise<ApiResult<AuthMeResponse>>>();
vi.mock('./auth', () => ({ fetchCurrentUser }));
vi.mock('./visitor', () => ({ getVisitor: async () => ({ clientIp: null, userAgent: null }) }));

const { getAdminSession } = await import('./admin');

const ADMIN: AuthMeResponse = { id: 'u1', login: 'owner', name: 'Owner', role: 'ADMIN', sessionId: 's1' };

function domain(status: number, error: Extract<ApiFailure, { kind: 'domain' }>['error'], key: string): ApiFailure {
  return { kind: 'domain', status, error, message: { key } };
}

beforeEach(() => {
  accessCookie = 'access-jwt';
  fetchCurrentUser.mockReset();
});

describe('getAdminSession (GET /auth/me)', () => {
  it('returns the signed-in admin; null without a cookie and for a non-admin user', async () => {
    fetchCurrentUser.mockResolvedValueOnce({ ok: true, status: 200, data: ADMIN });
    expect(await getAdminSession()).toEqual(ADMIN);
    expect(fetchCurrentUser).toHaveBeenCalledWith('access-jwt');
    fetchCurrentUser.mockResolvedValueOnce({ ok: true, status: 200, data: { ...ADMIN, role: 'USER' } });
    expect(await getAdminSession()).toBeNull();
    accessCookie = undefined;
    expect(await getAdminSession()).toBeNull();
    expect(fetchCurrentUser).toHaveBeenCalledTimes(2);
  });

  it('is null for a refused token: missing, malformed / expired / revoked, or a role without access', async () => {
    for (const failure of [
      domain(401, 'unauthorized', 'admin.auth.sessionRequired'),
      domain(401, 'accessTokenInvalid', 'admin.errors.sessionExpired'),
      domain(403, 'forbidden', 'admin.errors.forbidden'),
    ]) {
      fetchCurrentUser.mockResolvedValueOnce({ ok: false, failure });
      expect(await getAdminSession(), failure.kind === 'domain' ? failure.error : '').toBeNull();
    }
  });

  it('throws for an outage — a database down (500), a wrong internal key, a 429, no answer — never «signed out»', async () => {
    for (const failure of [
      domain(500, 'internal', 'admin.errors.actionFailed'),
      domain(401, 'internalKeyRequired', 'admin.errors.network'),
      domain(429, 'throttled', 'admin.auth.throttled'),
      domain(503, 'unavailable', 'admin.errors.network'),
      { kind: 'unavailable', status: null, reason: 'network' } as const,
      { kind: 'unavailable', status: 502, reason: 'badResponse' } as const,
    ] satisfies ApiFailure[]) {
      fetchCurrentUser.mockResolvedValueOnce({ ok: false, failure });
      await expect(getAdminSession()).rejects.toBeInstanceOf(ApiRequestError);
    }
  });
});
