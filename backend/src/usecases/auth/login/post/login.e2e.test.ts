import { deepStrictEqual, ok, strictEqual } from 'node:assert';
import { after, before, describe, it } from 'node:test';

import type { AuthTokensResponse } from '~shared/contracts/auth';
import type { ApiErrorResponse, ApiValidationErrorResponse } from '~shared/contracts/errors';

import { RequestHeader } from '~core/constants/request-header.enum';
import { TestClientIp } from '~test/e2e/client-ip';
import { TestAdmin } from '~test/e2e/test-admin';
import { TestApp } from '~test/e2e/test-app';

import { LOGIN_ROUTE } from './login.route';

describe('[e2e] POST /api/v1/auth/login', () => {
  let app: TestApp;
  let admin: TestAdmin;

  before(async () => {
    app = await TestApp.start();
    admin = await TestAdmin.create(app.database);
  });

  after(async () => {
    await admin.remove();
    await app.stop();
  });

  function login<T = ApiErrorResponse>(body: unknown, clientIp = TestClientIp.random()) {
    return app.api.post<T>(LOGIN_ROUTE, {
      body,
      headers: { [RequestHeader.CLIENT_IP]: clientIp, [RequestHeader.CLIENT_USER_AGENT]: 'e2e-agent' },
    });
  }

  function findLatestSession() {
    return app.database.client.session.findFirst({
      where: { userId: admin.id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  }

  it('signs in with login + password (login is case-insensitive) and opens a session', async () => {
    const response = await login<AuthTokensResponse>({ login: admin.login.toUpperCase(), password: admin.password });
    strictEqual(response.status, 200);
    strictEqual(response.body.tokenType, 'Bearer');
    strictEqual(response.body.accessToken.split('.').length, 3);
    ok(/^[0-9a-f-]{36}\.[A-Za-z0-9_-]{43}$/.test(response.body.refreshToken));
    ok(Date.parse(response.body.accessExpiresAt) > Date.now());
    ok(Date.parse(response.body.refreshExpiresAt) > Date.parse(response.body.accessExpiresAt));
    strictEqual((await findLatestSession())?.userAgent, 'e2e-agent');
  });

  it("stores the visitor's User-Agent only from x-client-user-agent, never the transport's own", async () => {
    const response = await app.api.post<AuthTokensResponse>(LOGIN_ROUTE, {
      body: { login: admin.login, password: admin.password },
      headers: { [RequestHeader.CLIENT_IP]: TestClientIp.random(), 'user-agent': 'node' },
    });
    strictEqual(response.status, 200);
    strictEqual((await findLatestSession())?.userAgent, null);
  });

  it('refuses a wrong password and an unknown login the same way', async () => {
    for (const body of [
      { login: admin.login, password: 'wrong-password' },
      { login: 'nobody-here', password: admin.password },
    ]) {
      const response = await login(body);
      strictEqual(response.status, 401);
      deepStrictEqual(response.body, {
        statusCode: 401,
        error: 'invalidCredentials',
        key: 'admin.auth.invalidCredentials',
      });
    }
  });

  it('answers validation errors with message keys per field', async () => {
    const response = await login<ApiValidationErrorResponse>({ login: '', password: 'x'.repeat(300), extra: true });
    strictEqual(response.status, 400);
    strictEqual(response.body.error, 'validation');
    deepStrictEqual(response.body.fields, {
      login: { key: 'admin.auth.loginRequired' },
      password: { key: 'admin.validation.tooLong', values: { max: 256 } },
      extra: { key: 'admin.validation.unknownField' },
    });
  });

  it('answers a malformed JSON body with 400 badRequest (Fastify parser errors go through the filter)', async () => {
    const response = await app.api.post<ApiErrorResponse>(LOGIN_ROUTE, { rawBody: '{"login": ' });
    strictEqual(response.status, 400);
    deepStrictEqual(response.body, { statusCode: 400, error: 'badRequest', key: 'admin.errors.invalidRequest' });
  });

  it('throttles repeated attempts per visitor IP + login (429 with the minutes to wait)', async () => {
    const clientIp = TestClientIp.random();
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 5; attempt += 1) {
      statuses.push((await login({ login: admin.login, password: 'wrong-password' }, clientIp)).status);
    }
    deepStrictEqual(statuses, [401, 401, 401, 401, 401]);
    const blocked = await login({ login: admin.login, password: admin.password }, clientIp);
    strictEqual(blocked.status, 429);
    deepStrictEqual(blocked.body, {
      statusCode: 429,
      error: 'throttled',
      key: 'admin.auth.throttled',
      values: { minutes: 5 },
    });
    strictEqual(
      (await login({ login: admin.login, password: admin.password })).status,
      200,
      'another IP is not blocked',
    );
  });
});
