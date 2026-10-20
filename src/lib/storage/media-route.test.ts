import { S3ServiceException } from '@aws-sdk/client-s3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GET, HEAD } from '@/app/media/[...key]/route';
import { getObject, headObject, type StoredObjectInfo } from '@/lib/storage';

vi.mock('@/lib/storage', () => ({ getObject: vi.fn(), headObject: vi.fn() }));

const KEY = ['admin', 'cmh1x2y3z0000abcd1234efgh', '3f2b8c1e-9a4d-4e7f-8b2a-1c3d5e7f9a0b', 'image.webp'];
const BYTES = new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80]);
const INFO: StoredObjectInfo = {
  contentType: 'image/webp',
  contentLength: BYTES.byteLength,
  etag: '"5d41402abc4b2a76b9719d911017c592"',
  lastModified: new Date(Date.UTC(2026, 9, 20, 12, 0, 0)),
};

function bodyStream(): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(BYTES);
      controller.close();
    },
  });
}

const context = (segments: string[]): { params: Promise<{ key: string[] }> } => ({
  params: Promise.resolve({ key: segments }),
});

const request = (segments: string[], headers: Record<string, string> = {}, method = 'GET'): Request =>
  new Request(`http://localhost/media/${segments.join('/')}`, { method, headers });

const get = (segments: string[], headers: Record<string, string> = {}): Promise<Response> =>
  GET(request(segments, headers), context(segments));

const head = (segments: string[], headers: Record<string, string> = {}): Promise<Response> =>
  HEAD(request(segments, headers, 'HEAD'), context(segments));

/** The /media route streams objects from the private bucket — only safe image keys, never anything else. */
describe('GET|HEAD /media/[...key]', () => {
  beforeEach(() => {
    vi.mocked(getObject).mockImplementation(async () => ({ kind: 'found', info: INFO, body: bodyStream() }));
    vi.mocked(headObject).mockImplementation(async () => INFO);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('streams an image with immutable caching, its ETag and a sandbox CSP', async () => {
    const response = await get(KEY);
    expect(response.status).toBe(200);
    expect(vi.mocked(getObject)).toHaveBeenCalledWith(KEY.join('/'), expect.objectContaining({}));
    expect(response.headers.get('content-type')).toBe('image/webp');
    expect(response.headers.get('content-length')).toBe(String(BYTES.byteLength));
    expect(response.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    expect(response.headers.get('etag')).toBe(INFO.etag);
    expect(response.headers.get('last-modified')).toBe(INFO.lastModified?.toUTCString());
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('content-security-policy')).toMatch(/default-src 'none'.*sandbox/);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(BYTES);
  });

  it('answers 304 to a matching If-None-Match without downloading the object', async () => {
    const cached = await get(KEY, { 'if-none-match': INFO.etag ?? '' });
    expect(cached.status).toBe(304);
    expect(cached.headers.get('etag')).toBe(INFO.etag);
    expect(cached.headers.get('cache-control')).toContain('immutable');
    expect(await cached.text()).toBe('');
    expect(vi.mocked(getObject)).not.toHaveBeenCalled();

    expect((await get(KEY, { 'if-none-match': `"other", W/${INFO.etag ?? ''}` })).status).toBe(304);
    expect((await get(KEY, { 'if-none-match': '*' })).status).toBe(304);

    const stale = await get(KEY, { 'if-none-match': '"other"' });
    expect(stale.status).toBe(200);
    expect(vi.mocked(getObject)).toHaveBeenCalledTimes(1);
  });

  it('never trusts an unexpected stored Content-Type (falls back to the extension)', async () => {
    vi.mocked(getObject).mockResolvedValueOnce({
      kind: 'found',
      info: { ...INFO, contentType: 'text/html' },
      body: bodyStream(),
    });
    const response = await get(KEY);
    expect(response.headers.get('content-type')).toBe('image/webp');
  });

  it('returns 404 for missing objects', async () => {
    vi.mocked(getObject).mockResolvedValueOnce({ kind: 'missing' });
    expect((await get(['admin', 'x', 'missing.webp'])).status).toBe(404);
    vi.mocked(headObject).mockResolvedValueOnce(null);
    expect((await head(['admin', 'x', 'missing.webp'])).status).toBe(404);
  });

  it('returns 404 for traversal, hidden, odd, too deep and non-image keys without asking S3', async () => {
    const invalid = [
      ['..', 'secret.webp'],
      ['admin', '..', '..', 'secret.webp'],
      ['.env'],
      ['admin', '.hidden.webp'],
      ['a b.webp'],
      ['a/b.webp'],
      ['1', '2', '3', '4', '5', '6', '7', '8', 'x.webp'],
      ['evil.svg'],
      ['page.html'],
      ['admin'],
      [`${'a'.repeat(300)}.webp`],
      ['admin', 'x'.repeat(256), 'image.webp'],
    ];
    for (const segments of invalid) {
      const response = await get(segments);
      expect(response.status, segments.join('/')).toBe(404);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect((await head(segments)).status, segments.join('/')).toBe(404);
    }
    expect(vi.mocked(getObject)).not.toHaveBeenCalled();
    expect(vi.mocked(headObject)).not.toHaveBeenCalled();
  });

  it('returns 502 (logged) when the storage fails', async () => {
    const failure = new S3ServiceException({
      name: 'InternalError',
      $fault: 'server',
      $metadata: { httpStatusCode: 500 },
      message: 'We encountered an internal error',
    });
    vi.mocked(getObject).mockRejectedValueOnce(failure);
    const response = await get(KEY);
    expect(response.status).toBe(502);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(console.error).toHaveBeenCalled();

    vi.mocked(headObject).mockRejectedValueOnce(new Error('connect ECONNREFUSED'));
    expect((await head(KEY)).status).toBe(502);

    // A 4xx for a valid key is a configuration problem (bucket name, region …), not a missing file.
    vi.mocked(getObject).mockRejectedValueOnce(
      new S3ServiceException({
        name: 'AuthorizationHeaderMalformed',
        $fault: 'client',
        $metadata: { httpStatusCode: 400 },
        message: 'The authorization header is malformed',
      }),
    );
    expect((await get(KEY)).status).toBe(502);
    expect(console.error).toHaveBeenCalledTimes(3);
  });

  it('treats a client that went away during the S3 call as a cancellation, not a storage failure', async () => {
    const abortWith = (controller: AbortController) => async (): Promise<never> => {
      controller.abort();
      throw Object.assign(new Error('Request aborted'), { name: 'AbortError' });
    };

    const getController = new AbortController();
    vi.mocked(getObject).mockImplementationOnce(abortWith(getController));
    const response = await GET(
      new Request(`http://localhost/media/${KEY.join('/')}`, { signal: getController.signal }),
      context(KEY),
    );
    expect(response.status).toBe(499);
    expect(response.headers.get('cache-control')).toBe('no-store');

    const headController = new AbortController();
    vi.mocked(headObject).mockImplementationOnce(abortWith(headController));
    const headResponse = await HEAD(
      new Request(`http://localhost/media/${KEY.join('/')}`, { method: 'HEAD', signal: headController.signal }),
      context(KEY),
    );
    expect(headResponse.status).toBe(499);
    expect(console.error).not.toHaveBeenCalled();
  });

  it('HEAD sends the headers from HeadObject without a body', async () => {
    const response = await head(KEY);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-length')).toBe(String(BYTES.byteLength));
    expect(response.headers.get('etag')).toBe(INFO.etag);
    expect(response.body).toBeNull();
    expect(vi.mocked(getObject)).not.toHaveBeenCalled();
    expect((await head(KEY, { 'if-none-match': INFO.etag ?? '' })).status).toBe(304);
  });
});
