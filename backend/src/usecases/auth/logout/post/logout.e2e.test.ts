import { strictEqual } from 'node:assert';
import { after, before, describe, it } from 'node:test';

import type { AuthMeResponse, AuthTokensResponse } from '~shared/contracts/auth';

import { SessionRevokeReason } from '~core/sessions/session-revoke-reason';
import { TestAdmin } from '~test/e2e/test-admin';
import { TestApp } from '~test/e2e/test-app';
import { LOGIN_ROUTE } from '~usecases/auth/login/post/login.route';
import { ME_ROUTE } from '~usecases/auth/me/get/me.route';
import { REFRESH_ROUTE } from '~usecases/auth/refresh/post/refresh.route';

import { LOGOUT_ROUTE } from './logout.route';

describe('[e2e] POST /api/v1/auth/logout', () => {
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

  it('ends the session: 204, then neither the refresh nor the access token works', async () => {
    const tokens = (
      await app.api.post<AuthTokensResponse>(LOGIN_ROUTE, { body: { login: admin.login, password: admin.password } })
    ).body;
    const me = await app.api.get<AuthMeResponse>(ME_ROUTE, { accessToken: tokens.accessToken });
    const logout = await app.api.post(LOGOUT_ROUTE, { body: { refreshToken: tokens.refreshToken } });
    strictEqual(logout.status, 204);
    strictEqual(logout.text, '');
    strictEqual((await app.api.post(REFRESH_ROUTE, { body: { refreshToken: tokens.refreshToken } })).status, 401);
    strictEqual((await app.api.get(ME_ROUTE, { accessToken: tokens.accessToken })).status, 401);
    const session = await app.database.client.session.findUnique({ where: { id: me.body.sessionId } });
    strictEqual(session?.revokeReason, SessionRevokeReason.LOGOUT);
  });

  it('is idempotent: an unknown or already used token is fine', async () => {
    strictEqual((await app.api.post(LOGOUT_ROUTE, { body: { refreshToken: 'garbage' } })).status, 204);
  });
});
