import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ApiResult } from './api-result';
import type { ApiRequestOptions } from './client';

const adminRequest = vi.fn<(path: string, options?: ApiRequestOptions) => Promise<ApiResult<unknown>>>(async () => ({
  ok: true,
  status: 200,
  data: {},
}));
const getAccessToken = vi.fn(async () => 'access-token');
vi.mock('./admin', () => ({ adminRequest, getAccessToken }));
vi.mock('./visitor', () => ({ getVisitor: async () => ({ clientIp: '203.0.113.7', userAgent: 'Browser/1.0' }) }));

const { deleteMediaFile, getMediaDetails, listMediaPage, MAX_UPLOAD_BODY_BYTES, saveMediaAlt, uploadMediaStream } =
  await import('./media');

const KEY = 'k'.repeat(40);
const CONTENT_TYPE = 'multipart/form-data; boundary=x';
const media = { id: 'm1', url: '/media/admin/u/f/image.webp' };

function streamOf(...chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('media library calls', () => {
  beforeEach(() => adminRequest.mockClear());

  it('reads pages (empty cursor left out), details, saves the alt text and deletes through /admin/media', async () => {
    await listMediaPage({ cursor: '', q: 'худи' });
    expect(adminRequest).toHaveBeenLastCalledWith('/api/v1/admin/media', { query: { cursor: null, q: 'худи' } });
    await getMediaDetails('a/b');
    expect(adminRequest).toHaveBeenLastCalledWith('/api/v1/admin/media/a%2Fb');
    await saveMediaAlt('m1', { ru: 'Худи' });
    expect(adminRequest).toHaveBeenLastCalledWith('/api/v1/admin/media/m1/alt', {
      method: 'PATCH',
      body: { alt: { ru: 'Худи' } },
    });
    await deleteMediaFile('m1');
    expect(adminRequest).toHaveBeenLastCalledWith('/api/v1/admin/media/m1', { method: 'DELETE' });
  });
});

describe('uploadMediaStream', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubEnv('BACKEND_URL', 'http://backend.test:4000');
    vi.stubEnv('INTERNAL_API_KEY', KEY);
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    getAccessToken.mockResolvedValue('access-token');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('streams the multipart body to the backend with the session, the visitor and the boundary', async () => {
    fetchMock.mockImplementationOnce(async (_url, init) => {
      expect(await new Response(init?.body ?? null).text()).toBe('--x\r\nbody');
      return json(media, 201);
    });
    const result = await uploadMediaStream({
      body: streamOf(new TextEncoder().encode('--x\r\nbody')),
      contentType: CONTENT_TYPE,
      contentLength: 9,
    });
    expect(result).toEqual({ ok: true, status: 201, data: media });
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toBe('http://backend.test:4000/api/v1/admin/media');
    const headers = new Headers(init?.headers);
    expect([headers.get('x-internal-key'), headers.get('authorization'), headers.get('content-type')]).toEqual([
      KEY,
      'Bearer access-token',
      CONTENT_TYPE,
    ]);
    expect([headers.get('x-client-ip'), headers.get('x-client-user-agent'), init?.method]).toEqual([
      '203.0.113.7',
      'Browser/1.0',
      'POST',
    ]);
    expect(init).toMatchObject({ duplex: 'half' });
  });

  it("passes the backend's error answer on as its failure", async () => {
    fetchMock.mockResolvedValueOnce(
      json(
        {
          statusCode: 415,
          error: 'unsupportedMediaType',
          key: 'admin.media.errors.unsupported',
          values: { formats: 'JPEG' },
        },
        415,
      ),
    );
    const result = await uploadMediaStream({
      body: streamOf(new Uint8Array(3)),
      contentType: CONTENT_TYPE,
      contentLength: null,
    });
    expect(result).toEqual({
      ok: false,
      failure: {
        kind: 'domain',
        status: 415,
        error: 'unsupportedMediaType',
        message: { key: 'admin.media.errors.unsupported', values: { formats: 'JPEG' } },
      },
    });
  });

  it('answers tooLarge for a declared or streamed body over the limit (nothing is sent for a declared one)', async () => {
    const tooLarge = {
      ok: false,
      failure: expect.objectContaining({
        status: 413,
        message: { key: 'admin.media.errors.tooLarge', values: { size: 15 } },
      }),
    };
    const declared = await uploadMediaStream({
      body: streamOf(),
      contentType: CONTENT_TYPE,
      contentLength: MAX_UPLOAD_BODY_BYTES + 1,
    });
    expect(declared).toEqual(tooLarge);
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockImplementationOnce(async (_url, init) => {
      await new Response(init?.body ?? null).arrayBuffer();
      return json(media, 201);
    });
    const chunk = new Uint8Array(MAX_UPLOAD_BODY_BYTES / 2 + 1);
    expect(
      await uploadMediaStream({ body: streamOf(chunk, chunk), contentType: CONTENT_TYPE, contentLength: null }),
    ).toEqual(tooLarge);
  });

  it('refuses without a session and reports an unreachable backend as unavailable', async () => {
    getAccessToken.mockResolvedValueOnce('');
    const anonymous = await uploadMediaStream({ body: streamOf(), contentType: CONTENT_TYPE, contentLength: null });
    expect(anonymous).toEqual({
      ok: false,
      failure: expect.objectContaining({ status: 401, message: { key: 'admin.auth.sessionRequired' } }),
    });
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
    const down = await uploadMediaStream({ body: streamOf(), contentType: CONTENT_TYPE, contentLength: null });
    expect(down).toEqual({ ok: false, failure: { kind: 'unavailable', status: null, reason: 'network' } });
  });
});
