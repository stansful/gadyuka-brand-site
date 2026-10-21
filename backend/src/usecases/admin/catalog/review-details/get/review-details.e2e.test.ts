import { deepStrictEqual, strictEqual } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import type { AdminReviewDetailsResponse } from '~shared/contracts/catalog';
import type { ApiErrorResponse } from '~shared/contracts/errors';

import { TestAdmin } from '~test/e2e/test-admin';
import { TestApp } from '~test/e2e/test-app';
import { CatalogFixtures } from '~usecases/admin/catalog/common/test/catalog-fixtures';

import { REVIEW_DETAILS_ROUTE } from './review-details.route';

describe('[e2e] GET /api/v1/admin/reviews/:id', () => {
  let app: TestApp;
  let admin: TestAdmin;
  let accessToken: string;
  let fixtures: CatalogFixtures;

  before(async () => {
    app = await TestApp.start();
    admin = await TestAdmin.create(app.database);
    accessToken = await admin.signIn(app.api);
    fixtures = new CatalogFixtures(app.database, admin.id);
  });

  after(async () => {
    await fixtures.remove();
    await admin.remove();
    await app.stop();
  });

  function details<T = AdminReviewDetailsResponse>(id: string) {
    return app.api.get<T>(REVIEW_DETAILS_ROUTE.replace(':id', id), { accessToken });
  }

  it('answers the edit form of a review with its avatar', async () => {
    const avatar = await fixtures.createMedia({ ru: 'Аватар' });
    const id = await fixtures.createReview(1);
    await app.database.client.review.update({ where: { id }, data: { role: { ru: 'покупатель' }, avatarId: avatar } });
    const response = await details(id);
    strictEqual(response.status, 200);
    const { avatar: picture, ...fields } = response.body;
    deepStrictEqual(fields, {
      id,
      author: fixtures.author('fixture'),
      role: { ru: 'покупатель' },
      text: { ru: 'Отлично' },
      rating: 1,
      published: false,
    });
    deepStrictEqual([picture?.id, picture?.alt], [avatar, { ru: 'Аватар' }]);
  });

  it('answers 404 notFound for an unknown id and 400 invalidId for a malformed one', async () => {
    const missing = await details<ApiErrorResponse>(randomUUID());
    deepStrictEqual([missing.status, missing.body.key], [404, 'admin.errors.notFound']);
    const malformed = await details<ApiErrorResponse>('seed-review-1');
    deepStrictEqual([malformed.status, malformed.body.key], [400, 'admin.errors.invalidId']);
  });
});
