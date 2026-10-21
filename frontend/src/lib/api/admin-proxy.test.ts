import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthTokensResponse } from '@shared/contracts/auth';

import type { ApiResult } from './api-result';

import { jwtExpiringAt, testTokens } from '../../../test/session-tokens';

const refreshSession = vi.fn<(token: string) => Promise<ApiResult<AuthTokensResponse>>>();
vi.mock('./auth', () => ({ refreshSession }));

const { adminProxy } = await import('./admin-proxy');
const { ADMIN_ACCESS_COOKIE, ADMIN_REFRESH_COOKIE } = await import('./session-cookies');

const NOW = Date.parse('2026-10-21T12:00:00.000Z');
const ORIGIN = 'http://localhost:3000';
let tokenSerial = 0;

function request(path: string, init: { method?: string; cookies?: Record<string, string> } = {}): NextRequest {
  const cookie = Object.entries(init.cookies ?? {})
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
  return new NextRequest(new URL(path, ORIGIN), { method: init.method ?? 'GET', headers: cookie ? { cookie } : {} });
}

/** NextResponse.next() marks the response with this header; a redirect carries Location instead. */
function passedThrough(response: Response): boolean {
  return response.headers.get('x-middleware-next') === '1';
}

/** A refresh token no other test used (the single flight remembers tokens for 30 s). */
function freshRefreshToken(): string {
  tokenSerial += 1;
  return `session-${tokenSerial}.secret`;
}

describe('adminProxy (admin session in src/proxy.ts)', () => {
  beforeEach(() => {
    refreshSession.mockReset();
  });

  it('passes a request with a fresh access cookie without calling the backend', async () => {
    const response = await adminProxy(
      request('/admin/leads', { cookies: { [ADMIN_ACCESS_COOKIE]: jwtExpiringAt(NOW + 600_000) } }),
      NOW,
    );
    expect(passedThrough(response)).toBe(true);
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it('refreshes an expired session once and hands the new cookies to the browser and to this render', async () => {
    const refreshToken = freshRefreshToken();
    const tokens = testTokens(NOW, 'next-session.secret');
    refreshSession.mockResolvedValue({ ok: true, status: 200, data: tokens });
    const cookies = { [ADMIN_ACCESS_COOKIE]: jwtExpiringAt(NOW - 1000), [ADMIN_REFRESH_COOKIE]: refreshToken };
    const [page, action, late] = await Promise.all([
      adminProxy(request('/admin/products', { cookies }), NOW),
      adminProxy(request('/admin/products', { method: 'POST', cookies }), NOW),
      adminProxy(request('/admin', { cookies: { [ADMIN_REFRESH_COOKIE]: refreshToken } }), NOW),
    ]);
    expect(refreshSession).toHaveBeenCalledTimes(1);
    for (const response of [page, action, late]) {
      expect(passedThrough(response)).toBe(true);
      expect(response.cookies.get(ADMIN_ACCESS_COOKIE)?.value).toBe(tokens.accessToken);
      expect(response.cookies.get(ADMIN_REFRESH_COOKIE)).toMatchObject({
        value: tokens.refreshToken,
        httpOnly: true,
        path: '/',
      });
      // The forwarded request carries the new cookies (x-middleware-request-cookie / override headers).
      expect(response.headers.get('x-middleware-request-cookie') ?? '').toContain(tokens.accessToken);
    }
  });

  it('sends a page load without a session to the login page with a safe `next`', async () => {
    const response = await adminProxy(request('/admin/leads?type=CONTACT'), NOW);
    expect(response.status).toBe(307);
    const location = new URL(response.headers.get('location') ?? '');
    expect(location.pathname).toBe('/admin/login');
    expect(location.searchParams.get('next')).toBe('/admin/leads?type=CONTACT');
    expect(new URL((await adminProxy(request('/admin'), NOW)).headers.get('location') ?? '').search).toBe('');
  });

  it('ends a session whose refresh token the backend refuses: cookies deleted, login page', async () => {
    refreshSession.mockResolvedValue({
      ok: false,
      failure: {
        kind: 'domain',
        status: 401,
        error: 'refreshTokenReused',
        message: { key: 'admin.errors.sessionExpired' },
      },
    });
    const response = await adminProxy(
      request('/admin/news', { cookies: { [ADMIN_REFRESH_COOKIE]: freshRefreshToken() } }),
      NOW,
    );
    expect(response.status).toBe(307);
    expect(response.cookies.get(ADMIN_REFRESH_COOKIE)).toMatchObject({ value: '', maxAge: 0 });
    expect(response.cookies.get(ADMIN_ACCESS_COOKIE)).toMatchObject({ value: '', maxAge: 0 });
  });

  it('never redirects a Server Action or the login page, and keeps the cookies when the backend is down', async () => {
    expect(passedThrough(await adminProxy(request('/admin/news', { method: 'POST' }), NOW))).toBe(true);
    expect(passedThrough(await adminProxy(request('/admin/login?next=/admin/news'), NOW))).toBe(true);
    refreshSession.mockResolvedValue({ ok: false, failure: { kind: 'unavailable', status: null, reason: 'network' } });
    const response = await adminProxy(
      request('/admin/news', { cookies: { [ADMIN_REFRESH_COOKIE]: freshRefreshToken() } }),
      NOW,
    );
    expect(passedThrough(response)).toBe(true);
    expect(response.cookies.get(ADMIN_REFRESH_COOKIE)).toBeUndefined();
  });

  it('keeps the session when the backend fails on its side (database down, wrong internal key), not a refusal', async () => {
    for (const failure of [
      { kind: 'domain', status: 500, error: 'internal', message: { key: 'admin.errors.actionFailed' } },
      { kind: 'domain', status: 401, error: 'internalKeyRequired', message: { key: 'admin.errors.network' } },
      { kind: 'domain', status: 429, error: 'throttled', message: { key: 'admin.auth.throttled' } },
    ] as const) {
      refreshSession.mockResolvedValueOnce({ ok: false, failure });
      const response = await adminProxy(
        request('/admin/news', { cookies: { [ADMIN_REFRESH_COOKIE]: freshRefreshToken() } }),
        NOW,
      );
      expect(passedThrough(response), failure.error).toBe(true);
      expect(response.cookies.get(ADMIN_REFRESH_COOKIE), failure.error).toBeUndefined();
      expect(response.cookies.get(ADMIN_ACCESS_COOKIE), failure.error).toBeUndefined();
    }
  });

  it('ends the session for a malformed refresh token (validation) and an unknown one', async () => {
    for (const failure of [
      { kind: 'validation', status: 400, fields: { refreshToken: { key: 'admin.validation.invalid' } } },
      { kind: 'domain', status: 401, error: 'refreshTokenInvalid', message: { key: 'admin.errors.sessionExpired' } },
    ] as const) {
      refreshSession.mockResolvedValueOnce({ ok: false, failure });
      const response = await adminProxy(
        request('/admin/news', { cookies: { [ADMIN_REFRESH_COOKIE]: freshRefreshToken() } }),
        NOW,
      );
      expect(response.status).toBe(307);
      expect(response.cookies.get(ADMIN_REFRESH_COOKIE)).toMatchObject({ value: '', maxAge: 0 });
    }
  });
});
