import { deepStrictEqual, strictEqual } from 'node:assert';
import { after, before, describe, it } from 'node:test';

import type { AuthMeResponse, AuthTokensResponse } from '~shared/contracts/auth';
import type { ApiErrorResponse } from '~shared/contracts/errors';

import { TestAdmin } from '~test/e2e/test-admin';
import { TestApp } from '~test/e2e/test-app';
import { LOGIN_ROUTE } from '~usecases/auth/login/post/login.route';

import { ME_ROUTE } from './me.route';

describe('[e2e] GET /api/v1/auth/me', () => {
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

  it('returns the signed-in user and the session', async () => {
    const tokens = (
      await app.api.post<AuthTokensResponse>(LOGIN_ROUTE, { body: { login: admin.login, password: admin.password } })
    ).body;
    const response = await app.api.get<AuthMeResponse>(ME_ROUTE, { accessToken: tokens.accessToken });
    strictEqual(response.status, 200);
    deepStrictEqual(
      { id: response.body.id, login: response.body.login, name: response.body.name, role: response.body.role },
      { id: admin.id, login: admin.login, name: 'E2E admin', role: 'ADMIN' },
    );
    strictEqual(response.body.sessionId.length, 36);
  });

  it('needs a bearer token (401 unauthorized) that is valid (401 accessTokenInvalid)', async () => {
    const missing = await app.api.get<ApiErrorResponse>(ME_ROUTE);
    deepStrictEqual(missing.body, { statusCode: 401, error: 'unauthorized', key: 'admin.auth.sessionRequired' });
    const invalid = await app.api.get<ApiErrorResponse>(ME_ROUTE, { accessToken: 'not.a.token' });
    deepStrictEqual(invalid.body, { statusCode: 401, error: 'accessTokenInvalid', key: 'admin.errors.sessionExpired' });
  });
});
