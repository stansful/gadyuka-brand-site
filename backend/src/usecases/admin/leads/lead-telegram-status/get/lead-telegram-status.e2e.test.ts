import { deepStrictEqual, strictEqual } from 'node:assert';
import { after, before, describe, it } from 'node:test';

import type { LeadTelegramStatusResponse } from '~shared/contracts/leads';

import { TestAdmin } from '~test/e2e/test-admin';
import { TestApp } from '~test/e2e/test-app';

import { LEAD_TELEGRAM_STATUS_ROUTE } from './lead-telegram-status.route';

describe('[e2e] GET /api/v1/admin/leads/telegram/status', () => {
  let app: TestApp;
  let admin: TestAdmin;
  let accessToken: string;

  before(async () => {
    app = await TestApp.start();
    admin = await TestAdmin.create(app.database);
    accessToken = await admin.signIn(app.api);
  });

  after(async () => {
    await admin.remove();
    await app.stop();
  });

  it('tells whether notifications are in dry-run mode (TELEGRAM_DRY_RUN=1 in .env.test)', async () => {
    const response = await app.api.get<LeadTelegramStatusResponse>(LEAD_TELEGRAM_STATUS_ROUTE, { accessToken });
    strictEqual(response.status, 200);
    deepStrictEqual(response.body, { dryRun: true });
  });

  it('needs a signed-in admin', async () => {
    strictEqual((await app.api.get(LEAD_TELEGRAM_STATUS_ROUTE)).status, 401);
  });
});
