import { deepStrictEqual, ok, strictEqual } from 'node:assert';
import { after, afterEach, before, describe, it, mock } from 'node:test';

import type { ApiErrorResponse } from '~shared/contracts/errors';
import type { HealthResponse } from '~shared/contracts/health';

import { RequestHeader } from '~core/constants/request-header.enum';
import { MediaStorage } from '~module/storage';
import { TestApp } from '~test/e2e/test-app';

import { HealthRepository } from './health.repository';
import { HEALTH_ROUTE } from './health.route';
import { HealthUsecase } from './health.usecase';

describe('[e2e] GET /api/v1/public/health', () => {
  let app: TestApp;

  before(async () => {
    app = await TestApp.start();
  });

  after(async () => {
    await app.stop();
  });

  afterEach(() => {
    mock.restoreAll();
  });

  async function failWith(error: Error): Promise<never> {
    throw error;
  }

  it('answers 200 with the state of the database and the storage', async () => {
    const response = await app.api.get<HealthResponse>(HEALTH_ROUTE);
    strictEqual(response.status, 200);
    strictEqual(response.body.status, 'ok');
    strictEqual(response.body.database, 'up');
    strictEqual(response.body.storage, 'up');
    ok(response.body.uptimeSeconds >= 0);
    ok(!Number.isNaN(Date.parse(response.body.timestamp)));
  });

  it('answers 503 with the state of each dependency when the storage is down (not cached)', async () => {
    mock.method(app.get(MediaStorage), 'assertAvailable', () => failWith(new Error('NoSuchBucket')));
    const response = await app.api.get<ApiErrorResponse>(HEALTH_ROUTE);
    strictEqual(response.status, 503);
    deepStrictEqual(response.body, {
      statusCode: 503,
      error: 'unavailable',
      key: 'admin.errors.actionFailed',
      details: { database: 'up', storage: 'down' },
    });
    strictEqual(response.headers.get('cache-control'), 'no-store');
  });

  it('answers 503 when the database does not answer', async () => {
    mock.method(app.get(HealthRepository), 'pingDatabase', () => failWith(new Error('ECONNREFUSED')));
    const response = await app.api.get<ApiErrorResponse>(HEALTH_ROUTE);
    strictEqual(response.status, 503);
    deepStrictEqual(response.body.details, { database: 'down', storage: 'up' });
  });

  it('answers an unexpected error with the generic 500 body only: no message, no stack, not cached', async () => {
    const secret = 'password authentication failed for user gadyuka at 10.0.0.5:5432';
    mock.method(app.get(HealthUsecase), 'execute', () => failWith(new Error(secret)));
    const response = await app.api.get<ApiErrorResponse>(HEALTH_ROUTE);
    strictEqual(response.status, 500);
    deepStrictEqual(response.body, { statusCode: 500, error: 'internal', key: 'admin.errors.actionFailed' });
    ok(!response.text.includes('10.0.0.5') && !response.text.includes('health.usecase'), response.text);
    strictEqual(response.headers.get('cache-control'), 'no-store');
  });

  it('refuses a request without the internal key (401 internalKeyRequired, not cached)', async () => {
    const response = await app.api.withoutInternalKey().get<ApiErrorResponse>(HEALTH_ROUTE);
    strictEqual(response.status, 401);
    strictEqual(response.body.error, 'internalKeyRequired');
    strictEqual(response.headers.get('cache-control'), 'no-store');
  });

  it('refuses a wrong internal key', async () => {
    const response = await app.api
      .withoutInternalKey()
      .get<ApiErrorResponse>(HEALTH_ROUTE, { headers: { [RequestHeader.INTERNAL_KEY]: 'wrong-key' } });
    strictEqual(response.status, 401);
    strictEqual(response.body.error, 'internalKeyRequired');
  });

  it('answers an unknown route with the JSON 404 body', async () => {
    const response = await app.api.get<ApiErrorResponse>('/api/v1/public/no-such-route');
    strictEqual(response.status, 404);
    deepStrictEqual(response.body, { statusCode: 404, error: 'notFound', key: 'admin.errors.notFound' });
  });
});
