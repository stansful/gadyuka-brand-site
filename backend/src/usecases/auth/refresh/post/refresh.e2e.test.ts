import { notStrictEqual, strictEqual } from 'node:assert';
import { after, before, describe, it } from 'node:test';

import type { AuthMeResponse, AuthTokensResponse } from '~shared/contracts/auth';
import type { ApiErrorResponse } from '~shared/contracts/errors';

import { SessionRevokeReason } from '~core/sessions/session-revoke-reason';
import { TestAdmin } from '~test/e2e/test-admin';
import { TestApp } from '~test/e2e/test-app';
import { LOGIN_ROUTE } from '~usecases/auth/login/post/login.route';
import { ME_ROUTE } from '~usecases/auth/me/get/me.route';

import { REFRESH_ROUTE } from './refresh.route';

describe('[e2e] POST /api/v1/auth/refresh', () => {
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

  async function signIn(): Promise<AuthTokensResponse> {
    return (
      await app.api.post<AuthTokensResponse>(LOGIN_ROUTE, { body: { login: admin.login, password: admin.password } })
    ).body;
  }

  function refresh(refreshToken: string) {
    return app.api.post<AuthTokensResponse & ApiErrorResponse>(REFRESH_ROUTE, { body: { refreshToken } });
  }

  it('rotates: a new pair of the same session; the old refresh token is exchanged', async () => {
    const first = await signIn();
    const second = await refresh(first.refreshToken);
    strictEqual(second.status, 200);
    notStrictEqual(second.body.refreshToken, first.refreshToken);
    const me = await app.api.get<AuthMeResponse>(ME_ROUTE, { accessToken: second.body.accessToken });
    const meBefore = await app.api.get<AuthMeResponse>(ME_ROUTE, { accessToken: first.accessToken });
    strictEqual(me.body.sessionId, meBefore.body.sessionId);
    strictEqual((await refresh(second.body.refreshToken)).status, 200);
  });

  it('detects reuse of an exchanged token: 401 refreshTokenReused and the whole session ends', async () => {
    const first = await signIn();
    const second = await refresh(first.refreshToken);
    const reuse = await refresh(first.refreshToken);
    strictEqual(reuse.status, 401);
    strictEqual(reuse.body.error, 'refreshTokenReused');
    strictEqual((await refresh(second.body.refreshToken)).body.error, 'refreshTokenInvalid');
    const me = await app.api.get<ApiErrorResponse>(ME_ROUTE, { accessToken: second.body.accessToken });
    strictEqual(me.status, 401);
    strictEqual(me.body.error, 'accessTokenInvalid');
    const tokenId = first.refreshToken.split('.')[0] ?? '';
    const stored = await app.database.client.refreshToken.findUnique({
      where: { id: tokenId },
      select: { session: true },
    });
    strictEqual(stored?.session.revokeReason, SessionRevokeReason.TOKEN_REUSE);
  });

  it('refuses unknown and malformed tokens', async () => {
    for (const refreshToken of ['garbage', `${'0'.repeat(8)}-0000-7000-8000-${'0'.repeat(12)}.${'a'.repeat(43)}`]) {
      const response = await refresh(refreshToken);
      strictEqual(response.status, 401, refreshToken);
      strictEqual(response.body.error, 'refreshTokenInvalid');
    }
    strictEqual((await refresh('')).status, 400);
  });
});
