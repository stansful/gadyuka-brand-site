import { deepStrictEqual, ok, strictEqual } from 'node:assert';
import { after, before, describe, it } from 'node:test';

import type { AdminReviewListResponse } from '~shared/contracts/catalog';
import type { ApiValidationErrorResponse } from '~shared/contracts/errors';

import { TestAdmin } from '~test/e2e/test-admin';
import { TestApp } from '~test/e2e/test-app';
import { CatalogFixtures } from '~usecases/admin/catalog/common/test/catalog-fixtures';

import { REVIEW_LIST_ROUTE } from './review-list.route';

/** Ratings here stay at 1 or none (higher ratings and the scale: settings-update.e2e.test.ts). */
describe('[e2e] GET /api/v1/admin/reviews', () => {
  let app: TestApp;
  let admin: TestAdmin;
  let accessToken: string;
  let fixtures: CatalogFixtures;
  let rated: string;
  let unrated: string;

  before(async () => {
    app = await TestApp.start();
    admin = await TestAdmin.create(app.database);
    accessToken = await admin.signIn(app.api);
    fixtures = new CatalogFixtures(app.database, admin.id);
    unrated = await fixtures.createReview(null, 2);
    rated = await fixtures.createReview(1, 1);
  });

  after(async () => {
    await fixtures.remove();
    await admin.remove();
    await app.stop();
  });

  function list<T = AdminReviewListResponse>(query = '') {
    return app.api.get<T>(`${REVIEW_LIST_ROUTE}${query}`, { accessToken });
  }

  function mine(response: AdminReviewListResponse): string[] {
    return response.items.filter(item => item.author.startsWith(fixtures.tag)).map(item => item.id);
  }

  it('lists the reviews in the site order with the current star scale', async () => {
    const response = await list();
    strictEqual(response.status, 200);
    deepStrictEqual(mine(response.body), [rated, unrated]);
    ok(Number.isInteger(response.body.ratingMax) && response.body.ratingMax >= 1 && response.body.ratingMax <= 10);
    const item = response.body.items.find(review => review.id === rated);
    deepStrictEqual(item, {
      id: rated,
      author: fixtures.author('fixture'),
      role: {},
      text: { ru: 'Отлично' },
      rating: 1,
      published: false,
      avatar: null,
    });
  });

  it('keeps only the reviews rated higher than ?ratingAbove (unrated ones never)', async () => {
    deepStrictEqual(mine((await list('?ratingAbove=0')).body), [rated]);
    deepStrictEqual(mine((await list('?ratingAbove=1')).body), []);
    deepStrictEqual(mine((await list('?ratingAbove=00')).body), [rated]);
  });

  it('refuses a ratingAbove that is not a whole number 0..10', async () => {
    for (const value of ['x', '11', '-1', '2.5', '']) {
      const response = await list<ApiValidationErrorResponse>(`?ratingAbove=${value}`);
      strictEqual(response.status, 400, value);
      deepStrictEqual(response.body.fields, { ratingAbove: { key: 'admin.validation.invalid' } }, value);
    }
  });
});
