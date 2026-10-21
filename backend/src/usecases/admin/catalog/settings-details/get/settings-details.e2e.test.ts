import { ok, strictEqual } from 'node:assert';
import { after, before, describe, it } from 'node:test';

import type { AdminSiteSettingsResponse } from '~shared/contracts/catalog';

import { TestAdmin } from '~test/e2e/test-admin';
import { TestApp } from '~test/e2e/test-app';

import { SETTINGS_DETAILS_ROUTE } from './settings-details.route';

/** Defaults and saved values are tested with the writes in settings-update.e2e.test.ts (one file: no races). */
describe('[e2e] GET /api/v1/admin/settings', () => {
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

  it('answers the settings form (contacts, star scale, SEO texts, OG image)', async () => {
    const response = await app.api.get<AdminSiteSettingsResponse>(SETTINGS_DETAILS_ROUTE, { accessToken });
    strictEqual(response.status, 200);
    const { phone, email, address, reviewRatingMax, seoTitle, seoDescription, ogImage } = response.body;
    ok(typeof phone === 'string' && typeof email === 'string');
    ok([address, seoTitle, seoDescription].every(text => typeof text === 'object' && text !== null));
    ok(Number.isInteger(reviewRatingMax) && reviewRatingMax >= 1 && reviewRatingMax <= 10);
    ok(ogImage === null || typeof ogImage.url === 'string');
  });

  it('needs a signed-in admin', async () => {
    strictEqual((await app.api.get(SETTINGS_DETAILS_ROUTE)).status, 401);
  });
});
