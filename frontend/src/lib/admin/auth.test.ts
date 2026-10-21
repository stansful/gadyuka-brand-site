import { describe, expect, it, vi } from 'vitest';

import { ApiRequestError } from '@/lib/api/api-result';
import type { AuthMeResponse } from '@shared/contracts/auth';

const getAdminSession = vi.fn<() => Promise<AuthMeResponse | null>>();
vi.mock('@/lib/api/admin', () => ({ getAdminSession }));

const { getLoginSessionState, isSameOriginRequest } = await import('./auth');

const post = (headers: Record<string, string>): Request =>
  new Request('http://localhost:3000/admin/api/media', { method: 'POST', headers });

describe('isSameOriginRequest (CSRF guard for admin route handlers)', () => {
  it('accepts same-origin browser requests', () => {
    expect(
      isSameOriginRequest(
        post({ host: 'localhost:3000', origin: 'http://localhost:3000', 'sec-fetch-site': 'same-origin' }),
      ),
    ).toBe(true);
  });

  it('accepts the forwarded host behind a reverse proxy', () => {
    expect(
      isSameOriginRequest(post({ host: 'app:3000', 'x-forwarded-host': 'gadyuka.ru', origin: 'https://gadyuka.ru' })),
    ).toBe(true);
  });

  it('rejects cross-site requests', () => {
    expect(isSameOriginRequest(post({ host: 'localhost:3000', origin: 'https://evil.example' }))).toBe(false);
    expect(isSameOriginRequest(post({ host: 'localhost:3000', 'sec-fetch-site': 'cross-site' }))).toBe(false);
    expect(isSameOriginRequest(post({ host: 'localhost:3000', origin: 'null' }))).toBe(false);
  });

  it('allows non-browser clients without Origin (they carry no ambient cookies cross-site)', () => {
    expect(isSameOriginRequest(post({ host: 'localhost:3000' }))).toBe(true);
  });
});

describe('getLoginSessionState (the login page never fails as a whole)', () => {
  it('tells signed in from signed out', async () => {
    getAdminSession.mockResolvedValueOnce({ id: 'u1', login: 'owner', name: 'Owner', role: 'ADMIN', sessionId: 's1' });
    expect(await getLoginSessionState()).toBe('signedIn');
    getAdminSession.mockResolvedValueOnce(null);
    expect(await getLoginSessionState()).toBe('signedOut');
  });

  it('is «unavailable» (the form with a notice) when the backend cannot check the session', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    getAdminSession.mockRejectedValueOnce(
      new ApiRequestError('/api/v1/auth/me', { kind: 'unavailable', status: null, reason: 'network' }),
    );
    expect(await getLoginSessionState()).toBe('unavailable');
    expect(error).toHaveBeenCalledOnce();
    error.mockRestore();
  });

  it('lets any other error through (a bug is not an outage)', async () => {
    getAdminSession.mockRejectedValueOnce(new TypeError('boom'));
    await expect(getLoginSessionState()).rejects.toThrow('boom');
  });
});
