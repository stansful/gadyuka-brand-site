import { deepStrictEqual, ok, strictEqual } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { after, afterEach, before, describe, it, mock } from 'node:test';

import { StorageServiceError } from '@nestjs/storage';

import sharp from 'sharp';

import type { ApiErrorResponse } from '~shared/contracts/errors';

import { MEDIA_CACHE_CONTROL, MEDIA_MIME } from '~core/media/media.constants';
import { TestApp } from '~test/e2e/test-app';

/**
 * The security headers as literals, not the constants the server sends: weakening a constant (dropping the
 * sandbox, allowing scripts, shortening the cache) must fail this test.
 */
const EXPECTED_CACHE_CONTROL = 'public, max-age=31536000, immutable';
const EXPECTED_CONTENT_SECURITY_POLICY = "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox";

describe('[e2e] GET|HEAD /media/*', () => {
  let app: TestApp;
  let image: Buffer;
  const key = `admin/${randomUUID()}/${randomUUID()}/image.webp`;

  before(async () => {
    app = await TestApp.start();
    image = await sharp({ create: { width: 4, height: 3, channels: 3, background: '#2d6a4f' } })
      .webp()
      .toBuffer();
    await app.mediaDisk.put(key, image, { contentType: MEDIA_MIME, cacheControl: MEDIA_CACHE_CONTROL });
  });

  after(async () => {
    await app.mediaDisk.delete(key);
    await app.stop();
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it('streams a stored object to anyone (no internal key), with immutable caching and safe headers', async () => {
    const response = await app.api.withoutInternalKey().get(`/media/${key}`);
    strictEqual(response.status, 200);
    strictEqual(response.headers.get('content-type'), MEDIA_MIME);
    strictEqual(response.headers.get('content-length'), String(image.byteLength));
    strictEqual(response.headers.get('cache-control'), EXPECTED_CACHE_CONTROL);
    strictEqual(response.headers.get('x-content-type-options'), 'nosniff');
    strictEqual(response.headers.get('content-security-policy'), EXPECTED_CONTENT_SECURITY_POLICY);
    ok((response.headers.get('content-disposition') ?? '').startsWith('inline'));
    ok(response.headers.get('etag'));
    strictEqual(response.text.length > 0, true);
  });

  it('answers a matching If-None-Match with 304 and no body', async () => {
    const first = await app.api.withoutInternalKey().get(`/media/${key}`);
    const etag = first.headers.get('etag') ?? '';
    const response = await app.api.withoutInternalKey().get(`/media/${key}`, { headers: { 'if-none-match': etag } });
    strictEqual(response.status, 304);
    strictEqual(response.text, '');
    strictEqual(response.headers.get('etag'), etag);
  });

  it('answers HEAD with the headers only', async () => {
    const response = await app.api.withoutInternalKey().head(`/media/${key}`);
    strictEqual(response.status, 200);
    strictEqual(response.headers.get('content-type'), MEDIA_MIME);
    strictEqual(response.text, '');
  });

  it('answers 404 for a missing object, without caching', async () => {
    const response = await app.api
      .withoutInternalKey()
      .get<ApiErrorResponse>(`/media/admin/${randomUUID()}/${randomUUID()}/image.webp`);
    strictEqual(response.status, 404);
    strictEqual(response.body.error, 'notFound');
    strictEqual(response.headers.get('cache-control'), 'no-store');
  });

  it('answers a storage outage with 502 storageUnavailable, without its details and without caching', async () => {
    mock.method(app.mediaDisk, 'get', async () => {
      throw new StorageServiceError({
        operation: 'get',
        code: 'NetworkError',
        message: 'connect ECONNREFUSED 10.0.0.9',
      });
    });
    const response = await app.api.withoutInternalKey().get<ApiErrorResponse>(`/media/${key}`);
    strictEqual(response.status, 502);
    deepStrictEqual(response.body, { statusCode: 502, error: 'storageUnavailable', key: 'admin.errors.actionFailed' });
    ok(!response.text.includes('10.0.0.9'), response.text);
    strictEqual(response.headers.get('cache-control'), 'no-store');
  });

  it('answers 404 for keys that are never looked up (not an image, hidden, traversal)', async () => {
    for (const path of [
      '/media/evil.svg',
      '/media/admin/.env.webp',
      '/media/a/%2e%2e/b.webp',
      '/media/',
      '/media/a%20b.webp',
    ]) {
      const response = await app.api.withoutInternalKey().get<ApiErrorResponse>(path);
      strictEqual(response.status, 404, path);
    }
  });
});
