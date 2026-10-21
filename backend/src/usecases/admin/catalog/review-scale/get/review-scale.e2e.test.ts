import { ok, strictEqual } from 'node:assert';
import { after, before, describe, it } from 'node:test';

import type { AdminReviewRatingScaleResponse } from '~shared/contracts/catalog';

import { TestAdmin } from '~test/e2e/test-admin';
import { TestApp } from '~test/e2e/test-app';

import { REVIEW_SCALE_ROUTE } from './review-scale.route';

/** The scale changes and its effects are tested in settings-update.e2e.test.ts (one file: no races). */
describe('[e2e] GET /api/v1/admin/reviews/rating-scale', () => {
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

  it('answers the current star scale (1..10), not the review with id "rating-scale"', async () => {
    const response = await app.api.get<AdminReviewRatingScaleResponse>(REVIEW_SCALE_ROUTE, { accessToken });
    strictEqual(response.status, 200);
    ok(Number.isInteger(response.body.max) && response.body.max >= 1 && response.body.max <= 10);
  });
});
