import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MEDIA_HEADERS_TIMEOUT_MS, proxyMediaRequest } from './media-proxy';

const KEY = ['admin', '0199f2c4-0000-7000-8000-00000000ad01', '0199f2c4-1111-7000-8000-000000000001', 'image.webp'];
const BYTES = new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80]);
const UPSTREAM_HEADERS = {
  'content-type': 'image/webp',
  'content-length': String(BYTES.byteLength),
  'cache-control': 'public, max-age=31536000, immutable',
  etag: '"abc"',
  'last-modified': 'Tue, 20 Oct 2026 12:00:00 GMT',
  'x-content-type-options': 'nosniff',
  'content-security-policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
  'set-cookie': 'leak=1',
  server: 'fastify',
};

describe('GET|HEAD /media/<key> → backend', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubEnv('BACKEND_URL', 'http://backend.test:4000');
    vi.stubEnv('INTERNAL_API_KEY', 'k'.repeat(40));
    vi.stubGlobal('fetch', fetchMock);
    fetchMock
      .mockReset()
      .mockImplementation(async () => new Response(BYTES, { status: 200, headers: UPSTREAM_HEADERS }));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const get = (headers: Record<string, string> = {}, method = 'GET', segments = KEY): Promise<Response> =>
    proxyMediaRequest(new Request(`http://localhost/media/${segments.join('/')}`, { method, headers }), segments);

  it('streams the object with the caching and security headers of the backend (and nothing else)', async () => {
    const response = await get({ 'if-none-match': '"old"', range: 'bytes=0-3', cookie: 'secret=1' });
    expect(response.status).toBe(200);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(BYTES);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe(`http://backend.test:4000/media/${KEY.join('/')}`);
    expect(Object.fromEntries(new Headers(init?.headers))).toEqual({ 'if-none-match': '"old"', range: 'bytes=0-3' });
    for (const name of [
      'content-type',
      'content-length',
      'cache-control',
      'etag',
      'last-modified',
      'content-security-policy',
    ]) {
      expect(response.headers.get(name), name).toBe(UPSTREAM_HEADERS[name as keyof typeof UPSTREAM_HEADERS]);
    }
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(response.headers.get('server')).toBeNull();
  });

  it('passes 304 and HEAD through without a body', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 304, headers: { etag: '"abc"' } }));
    const notModified = await get({ 'if-none-match': '"abc"' });
    expect(notModified.status).toBe(304);
    expect(notModified.headers.get('etag')).toBe('"abc"');
    const head = await get({}, 'HEAD');
    expect(head.status).toBe(200);
    expect(head.body).toBeNull();
    expect(fetchMock.mock.calls[1]?.[1]?.method).toBe('HEAD');
  });

  it('answers 404 to keys no object can have, without asking the backend', async () => {
    for (const segments of [
      ['..', 'x.webp'],
      ['.env'],
      ['a b.webp'],
      ['1', '2', '3', '4', '5', '6', '7', '8', 'x.webp'],
      [],
    ]) {
      const response = await get({}, 'GET', segments);
      expect(response.status, segments.join('/')).toBe(404);
      expect(response.headers.get('cache-control')).toBe('no-store');
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('answers 502 (logged) when the backend cannot be reached, 499 when the client went away', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
    const down = await get();
    expect(down.status).toBe(502);
    expect(down.headers.get('cache-control')).toBe('no-store');
    expect(console.error).toHaveBeenCalledOnce();

    const controller = new AbortController();
    fetchMock.mockImplementationOnce(async () => {
      controller.abort();
      throw Object.assign(new Error('aborted'), { name: 'AbortError' });
    });
    const cancelled = await proxyMediaRequest(
      new Request(`http://localhost/media/${KEY.join('/')}`, { signal: controller.signal }),
      KEY,
    );
    expect(cancelled.status).toBe(499);
    expect(console.error).toHaveBeenCalledOnce();
  });

  it('answers 504 when the backend accepts the request but sends no headers in time', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      // A stalled backend: the response never starts; only the request's signal ends the wait.
      fetchMock.mockImplementationOnce(
        (_url, init) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
          }),
      );
      // No client signal that could fire: /_next/image calls the handler with a request of its own.
      const pending = get();
      await vi.advanceTimersByTimeAsync(MEDIA_HEADERS_TIMEOUT_MS - 1);
      expect(fetchMock).toHaveBeenCalledOnce();
      let settled = false;
      void pending.then(() => {
        settled = true;
      });
      await Promise.resolve();
      expect(settled).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      const response = await pending;
      expect(response.status).toBe(504);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(console.error).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not cut a body that streams after the headers arrived in time', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      let push: (chunk: Uint8Array | null) => void = () => undefined;
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          push = chunk => (chunk ? controller.enqueue(chunk) : controller.close());
        },
      });
      fetchMock.mockImplementationOnce(async () => new Response(body, { status: 200, headers: UPSTREAM_HEADERS }));
      const response = await get();
      await vi.advanceTimersByTimeAsync(MEDIA_HEADERS_TIMEOUT_MS * 3);
      push(BYTES);
      push(null);
      expect(new Uint8Array(await response.arrayBuffer())).toEqual(BYTES);
    } finally {
      vi.useRealTimers();
    }
  });
});
