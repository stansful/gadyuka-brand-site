import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { readBackendEnv } from './backend-env';
import { apiRequest, failureOf } from './client';
import { clientIpFromHeaders } from './client-ip';

const KEY = 'k'.repeat(40);

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('readBackendEnv', () => {
  it('accepts an http(s) origin and a long enough key', () => {
    expect(readBackendEnv({ BACKEND_URL: 'http://127.0.0.1:4000/', INTERNAL_API_KEY: KEY })).toEqual({
      ok: true,
      env: { backendUrl: 'http://127.0.0.1:4000', internalKey: KEY },
    });
  });

  it('names the problem, never the value', () => {
    for (const env of [
      { INTERNAL_API_KEY: KEY },
      { BACKEND_URL: 'ftp://backend', INTERNAL_API_KEY: KEY },
      { BACKEND_URL: 'http://backend:4000/api', INTERNAL_API_KEY: KEY },
      { BACKEND_URL: 'http://user:secret@backend:4000', INTERNAL_API_KEY: KEY },
      { BACKEND_URL: 'http://backend:4000', INTERNAL_API_KEY: 'short' },
    ]) {
      const result = readBackendEnv(env);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.problem).not.toContain('secret');
    }
  });
});

describe('apiRequest', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubEnv('BACKEND_URL', 'http://backend.test:4000');
    vi.stubEnv('INTERNAL_API_KEY', KEY);
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  function sentRequest(): { url: string; init: RequestInit; headers: Headers } {
    const [url, init = {}] = fetchMock.mock.calls[0] ?? [];
    return { url: String(url), init, headers: new Headers(init.headers) };
  }

  it('sends the internal key, the visitor, the token and a JSON body; returns the data', async () => {
    fetchMock.mockResolvedValueOnce(json({ id: '1' }, 201));
    const result = await apiRequest<{ id: string }>('/api/v1/admin/things', {
      method: 'POST',
      body: { title: 'x' },
      query: { page: 2, empty: null },
      accessToken: 'jwt',
      visitor: { clientIp: '203.0.113.7', userAgent: 'test-agent' },
    });
    expect(result).toEqual({ ok: true, status: 201, data: { id: '1' } });
    const { url, init, headers } = sentRequest();
    expect(url).toBe('http://backend.test:4000/api/v1/admin/things?page=2');
    expect(init.body).toBe('{"title":"x"}');
    expect(Object.fromEntries(headers)).toMatchObject({
      'x-internal-key': KEY,
      'x-client-ip': '203.0.113.7',
      'x-client-user-agent': 'test-agent',
      authorization: 'Bearer jwt',
      'content-type': 'application/json',
    });
    expect(headers.has('user-agent')).toBe(false);
  });

  it("leaves the visitor headers out when the visitor sent none (never the transport's own user-agent)", async () => {
    fetchMock.mockResolvedValueOnce(json({ id: '1' }, 201));
    await apiRequest('/api/v1/public/leads', {
      method: 'POST',
      body: {},
      visitor: { clientIp: null, userAgent: null },
    });
    const { headers } = sentRequest();
    expect([headers.has('x-client-ip'), headers.has('x-client-user-agent'), headers.has('user-agent')]).toEqual([
      false,
      false,
      false,
    ]);
  });

  it("waits the contract's 10 s by default and longer when a route asks for it", async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    fetchMock.mockResolvedValue(json({}));
    await apiRequest('/api/v1/x');
    await apiRequest('/api/v1/x', { timeoutMs: 50_000 });
    expect(timeout.mock.calls).toEqual([[10_000], [50_000]]);
    timeout.mockRestore();
  });

  it('reads 204 as no data', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    expect(await apiRequest<void>('/api/v1/admin/entities/news/1', { method: 'DELETE' })).toEqual({
      ok: true,
      status: 204,
      data: undefined,
    });
  });

  it('turns the backend error bodies into validation / domain failures', async () => {
    fetchMock.mockResolvedValueOnce(
      json(
        {
          statusCode: 400,
          error: 'validation',
          fields: { 'title.en': { key: 'admin.validation.tooLong', values: { max: 200 } } },
        },
        400,
      ),
    );
    expect(await apiRequest('/api/v1/admin/x')).toEqual({
      ok: false,
      failure: {
        kind: 'validation',
        status: 400,
        fields: { 'title.en': { key: 'admin.validation.tooLong', values: { max: 200 } } },
      },
    });
    fetchMock.mockResolvedValueOnce(
      json({ statusCode: 429, error: 'throttled', key: 'admin.auth.throttled', values: { minutes: 5 } }, 429),
    );
    expect(await apiRequest('/api/v1/auth/login')).toEqual({
      ok: false,
      failure: {
        kind: 'domain',
        status: 429,
        error: 'throttled',
        message: { key: 'admin.auth.throttled', values: { minutes: 5 } },
      },
    });
  });

  it('reports an unusable answer, a network error, a timeout and a missing configuration as unavailable', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('<html>Bad gateway</html>', { status: 502, headers: { 'content-type': 'text/html' } }),
    );
    expect(await apiRequest('/api/v1/x')).toEqual({
      ok: false,
      failure: { kind: 'unavailable', status: 502, reason: 'badResponse' },
    });
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
    expect(await apiRequest('/api/v1/x')).toEqual({
      ok: false,
      failure: { kind: 'unavailable', status: null, reason: 'network' },
    });
    fetchMock.mockRejectedValueOnce(Object.assign(new Error('timed out'), { name: 'TimeoutError' }));
    expect(await apiRequest('/api/v1/x')).toEqual({
      ok: false,
      failure: { kind: 'unavailable', status: null, reason: 'timeout' },
    });
    vi.stubEnv('INTERNAL_API_KEY', '');
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(await apiRequest('/api/v1/x')).toEqual({
      ok: false,
      failure: { kind: 'unavailable', status: null, reason: 'config' },
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('keeps only well-formed message refs of a validation body', () => {
    expect(
      failureOf(400, { error: 'validation', fields: { a: { key: 'k' }, b: 'x', c: { key: 'k2', values: { n: 1 } } } }),
    ).toEqual({
      kind: 'validation',
      status: 400,
      fields: { a: { key: 'k' }, c: { key: 'k2', values: { n: 1 } } },
    });
  });
});

describe('clientIpFromHeaders (x-client-ip of backend calls)', () => {
  it('takes X-Real-IP (set by the proxy from the TCP peer), else the last X-Forwarded-For hop', () => {
    expect(
      clientIpFromHeaders(new Headers({ 'x-forwarded-for': '10.0.0.1, 198.51.100.9', 'x-real-ip': '198.51.100.4' })),
    ).toBe('198.51.100.4');
    expect(clientIpFromHeaders(new Headers({ 'x-real-ip': '2001:db8::1' }))).toBe('2001:db8::1');
    expect(clientIpFromHeaders(new Headers({ 'x-forwarded-for': '[2001:db8::2]:443' }))).toBe('2001:db8::2');
    expect(clientIpFromHeaders(new Headers({ 'x-forwarded-for': '198.51.100.4:8080' }))).toBe('198.51.100.4');
  });

  it('ignores the hops a visitor prepends to X-Forwarded-For (a proxy that appends)', () => {
    expect(clientIpFromHeaders(new Headers({ 'x-forwarded-for': '1.2.3.4, 203.0.113.50' }))).toBe('203.0.113.50');
    expect(clientIpFromHeaders(new Headers({ 'x-forwarded-for': '1.2.3.4,203.0.113.50 ' }))).toBe('203.0.113.50');
  });

  it('never trusts an incoming x-client-ip and ignores garbage', () => {
    expect(clientIpFromHeaders(new Headers({ 'x-client-ip': '1.2.3.4' }))).toBeNull();
    expect(clientIpFromHeaders(new Headers({ 'x-forwarded-for': 'unknown', 'x-real-ip': 'not-an-ip' }))).toBeNull();
    expect(clientIpFromHeaders(new Headers({ 'x-forwarded-for': '192.0.2.1', 'x-real-ip': 'garbage' }))).toBe(
      '192.0.2.1',
    );
  });
});
