import { deepStrictEqual, strictEqual } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import type { AdminCatalogRowSaved, AdminReviewSaveRequest } from '~shared/contracts/catalog';
import type { ApiErrorResponse, ApiValidationErrorResponse } from '~shared/contracts/errors';

import { TestAdmin } from '~test/e2e/test-admin';
import { TestApp } from '~test/e2e/test-app';
import { CatalogFixtures } from '~usecases/admin/catalog/common/test/catalog-fixtures';

import { REVIEW_CREATE_ROUTE } from './review-create.route';

/** Ratings here stay at 1 or none (the star scale tests live in settings-update.e2e.test.ts). */
describe('[e2e] POST /api/v1/admin/reviews', () => {
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
    const base = { author: fixtures.author('Анна'), role: {}, text: { ru: 'Отлично' }, avatarId: null, rating: null };
    return { ...base, published: false, ...overrides };
  }

  function create<T = AdminCatalogRowSaved>(body: unknown) {
    return app.api.post<T>(REVIEW_CREATE_ROUTE, { body, accessToken });
  }

  it('adds the review last in the list, normalized (201 { id })', async () => {
    const avatar = await fixtures.createMedia();
    const first = await create(input());
    const second = await create(
      input({
        author: ` ${fixtures.author('Сергей')} `,
        role: { ru: ' покупатель ', en: '' },
        avatarId: avatar,
        rating: 1,
        published: true,
      }),
    );
    deepStrictEqual([first.status, second.status], [201, 201]);
    const rows = await app.database.client.review.findMany({
      where: { id: { in: [first.body.id, second.body.id] } },
      select: {
        id: true,
        author: true,
        role: true,
        text: true,
        avatarId: true,
        rating: true,
        published: true,
        order: true,
      },
    });
    const byId = new Map(rows.map(({ id, order, ...fields }) => [id, { order, fields }]));
    deepStrictEqual(byId.get(second.body.id)?.fields, {
      author: fixtures.author('Сергей'),
      role: { ru: 'покупатель' },
      text: { ru: 'Отлично' },
      avatarId: avatar,
      rating: 1,
      published: true,
    });
    strictEqual(byId.get(second.body.id)?.order, (byId.get(first.body.id)?.order ?? -1) + 1);
  });

  it('refuses an avatar that is not in the media library (400 missingMedia)', async () => {
    const response = await create<ApiErrorResponse>(input({ avatarId: randomUUID() }));
    deepStrictEqual(response.body, { statusCode: 400, error: 'badRequest', key: 'admin.errors.missingMedia' });
  });

  it('refuses an invalid form with field keys', async () => {
    const response = await create<ApiValidationErrorResponse>({
      ...input(),
      author: ' ',
      text: { en: 'Great' },
      rating: 11,
    });
    strictEqual(response.status, 400);
    deepStrictEqual(response.body.fields, {
      author: { key: 'admin.validation.authorRequired' },
      'text.ru': { key: 'admin.validation.requiredText', values: { locale: 'ru' } },
      rating: { key: 'admin.validation.ratingTooHigh', values: { max: 10 } },
    });
  });
});
