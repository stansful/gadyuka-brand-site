import { deepStrictEqual, strictEqual } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import type { AdminCatalogRowSaved, AdminReviewSaveRequest } from '~shared/contracts/catalog';
import type { ApiErrorResponse } from '~shared/contracts/errors';

import { TestAdmin } from '~test/e2e/test-admin';
import { TestApp } from '~test/e2e/test-app';
import { CatalogFixtures } from '~usecases/admin/catalog/common/test/catalog-fixtures';

import { REVIEW_UPDATE_ROUTE } from './review-update.route';

/** Ratings here stay at 1 or none (the star scale tests live in settings-update.e2e.test.ts). */
describe('[e2e] PUT /api/v1/admin/reviews/:id', () => {
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

  function input(overrides: Partial<AdminReviewSaveRequest> = {}): AdminReviewSaveRequest {
    const base = { author: fixtures.author('Анна'), role: { ru: 'покупатель' }, text: { ru: 'Новый текст' } };
    return { ...base, avatarId: null, rating: 1, published: true, ...overrides };
  }

  function update<T = AdminCatalogRowSaved>(id: string, body: unknown) {
    return app.api.put<T>(REVIEW_UPDATE_ROUTE.replace(':id', id), { body, accessToken });
  }

  it('saves the form, keeping the position of the review (200 { id })', async () => {
    const id = await fixtures.createReview(null, 9);
    const avatar = await fixtures.createMedia();
    const response = await update(id, input({ text: { ru: 'Новый текст', en: ' New ' }, avatarId: avatar }));
    deepStrictEqual([response.status, response.body], [200, { id }]);
    const row = await app.database.client.review.findUniqueOrThrow({
      where: { id },
      select: { author: true, role: true, text: true, avatarId: true, rating: true, published: true, order: true },
    });
    deepStrictEqual(row, {
      author: fixtures.author('Анна'),
      role: { ru: 'покупатель' },
      text: { ru: 'Новый текст', en: 'New' },
      avatarId: avatar,
      rating: 1,
      published: true,
      order: 9,
    });
  });

  it('removes the rating and the avatar when they are cleared', async () => {
    const id = await fixtures.createReview(1);
    strictEqual((await update(id, input({ rating: null, avatarId: null }))).status, 200);
    const row = await app.database.client.review.findUniqueOrThrow({
      where: { id },
      select: { rating: true, avatarId: true },
    });
    deepStrictEqual(row, { rating: null, avatarId: null });
  });

  it('answers 404 notFound for a deleted review, 400 invalidId / missingMedia otherwise', async () => {
    const missing = await update<ApiErrorResponse>(randomUUID(), input());
    deepStrictEqual(missing.body, { statusCode: 404, error: 'notFound', key: 'admin.errors.notFound' });
    const malformed = await update<ApiErrorResponse>('seed-review-1', input());
    deepStrictEqual([malformed.status, malformed.body.key], [400, 'admin.errors.invalidId']);
    const id = await fixtures.createReview(null);
    const avatar = await update<ApiErrorResponse>(id, input({ avatarId: randomUUID() }));
    deepStrictEqual([avatar.status, avatar.body.key], [400, 'admin.errors.missingMedia']);
  });
});
