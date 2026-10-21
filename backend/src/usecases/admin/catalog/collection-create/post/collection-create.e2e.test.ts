import { deepStrictEqual, strictEqual } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import type { AdminCatalogRowSaved, AdminCollectionSaveRequest } from '~shared/contracts/catalog';
import type { ApiErrorResponse, ApiValidationErrorResponse } from '~shared/contracts/errors';

import { TestAdmin } from '~test/e2e/test-admin';
import { TestApp } from '~test/e2e/test-app';
import { CatalogFixtures } from '~usecases/admin/catalog/common/test/catalog-fixtures';

import { COLLECTION_CREATE_ROUTE } from './collection-create.route';

describe('[e2e] POST /api/v1/admin/collections', () => {
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

  function input(name: string, overrides: Partial<AdminCollectionSaveRequest> = {}): AdminCollectionSaveRequest {
    return {
      slug: fixtures.slug(name),
      title: { ru: name },
      description: {},
      coverId: null,
      published: false,
      ...overrides,
    };
  }

  function create<T = AdminCatalogRowSaved>(body: unknown) {
    return app.api.post<T>(COLLECTION_CREATE_ROUTE, { body, accessToken });
  }

  it('creates the collection last in the list, normalized (201 { id })', async () => {
    const cover = await fixtures.createMedia();
    const first = await create(input('first'));
    const second = await create({
      ...input('second'),
      slug: ` ${fixtures.slug('Second').toUpperCase()} `,
      title: { ru: ' Вторая ', en: '' },
      description: { en: ' About ' },
      coverId: cover,
      published: true,
    });
    strictEqual(first.status, 201);
    strictEqual(second.status, 201);
    const rows = await app.database.client.collection.findMany({
      where: { id: { in: [first.body.id, second.body.id] } },
      select: { id: true, slug: true, title: true, description: true, coverId: true, published: true, order: true },
    });
    const byId = new Map(rows.map(({ id, order, ...fields }) => [id, { order, fields }]));
    deepStrictEqual(byId.get(second.body.id)?.fields, {
      slug: fixtures.slug('second'),
      title: { ru: 'Вторая' },
      description: { en: 'About' },
      coverId: cover,
      published: true,
    });
    strictEqual(byId.get(second.body.id)?.order, (byId.get(first.body.id)?.order ?? -1) + 1);
  });

  it('refuses a slug another collection has (409 slugTaken), before checking the cover', async () => {
    await create(input('taken'));
    const response = await create<ApiErrorResponse>(input('taken', { coverId: randomUUID() }));
    strictEqual(response.status, 409);
    deepStrictEqual(response.body, { statusCode: 409, error: 'conflict', key: 'admin.errors.slugTaken' });
  });

  it('refuses a cover that is not in the media library (400 missingMedia)', async () => {
    const response = await create<ApiErrorResponse>(input('no-cover', { coverId: randomUUID() }));
    strictEqual(response.status, 400);
    deepStrictEqual(response.body, { statusCode: 400, error: 'badRequest', key: 'admin.errors.missingMedia' });
  });

  it('refuses an invalid form with field keys', async () => {
    const response = await create<ApiValidationErrorResponse>({
      ...input('bad'),
      slug: 'два слова',
      title: { en: 'x'.repeat(201) },
      coverId: 'cover',
      extra: true,
    });
    strictEqual(response.status, 400);
    deepStrictEqual(response.body.fields, {
      slug: { key: 'admin.validation.slugFormat' },
      'title.ru': { key: 'admin.validation.requiredText', values: { locale: 'ru' } },
      'title.en': { key: 'admin.validation.tooLong', values: { max: 200 } },
      coverId: { key: 'admin.validation.idInvalid' },
      extra: { key: 'admin.validation.unknownField' },
    });
  });
});
