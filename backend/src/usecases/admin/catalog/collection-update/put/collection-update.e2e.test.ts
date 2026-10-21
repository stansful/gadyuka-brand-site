import { deepStrictEqual, strictEqual } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import type { AdminCatalogRowSaved, AdminCollectionSaveRequest } from '~shared/contracts/catalog';
import type { ApiErrorResponse } from '~shared/contracts/errors';

import { TestAdmin } from '~test/e2e/test-admin';
import { TestApp } from '~test/e2e/test-app';
import { CatalogFixtures, FixtureCollection } from '~usecases/admin/catalog/common/test/catalog-fixtures';

import { COLLECTION_UPDATE_ROUTE } from './collection-update.route';

describe('[e2e] PUT /api/v1/admin/collections/:id', () => {
  let app: TestApp;
  let admin: TestAdmin;
  let accessToken: string;
  let fixtures: CatalogFixtures;
  let edited: FixtureCollection;
  let other: FixtureCollection;

  before(async () => {
    app = await TestApp.start();
    admin = await TestAdmin.create(app.database);
    accessToken = await admin.signIn(app.api);
    fixtures = new CatalogFixtures(app.database, admin.id);
    edited = await fixtures.createCollection('edited', 7);
    other = await fixtures.createCollection('other', 8);
  });

  after(async () => {
    await fixtures.remove();
    await admin.remove();
    await app.stop();
  });

  function input(overrides: Partial<AdminCollectionSaveRequest> = {}): AdminCollectionSaveRequest {
    return {
      slug: edited.slug,
      title: { ru: 'Изменённая' },
      description: {},
      coverId: null,
      published: true,
      ...overrides,
    };
  }

  function update<T = AdminCatalogRowSaved>(id: string, body: unknown) {
    return app.api.put<T>(COLLECTION_UPDATE_ROUTE.replace(':id', id), { body, accessToken });
  }

  it('saves the form, keeping the slug of the collection and its position (200 { id })', async () => {
    const cover = await fixtures.createMedia();
    const response = await update(edited.id, input({ description: { ru: ' Описание ', en: '' }, coverId: cover }));
    strictEqual(response.status, 200);
    deepStrictEqual(response.body, { id: edited.id });
    const row = await app.database.client.collection.findUniqueOrThrow({
      where: { id: edited.id },
      select: { slug: true, title: true, description: true, coverId: true, published: true, order: true },
    });
    deepStrictEqual(row, {
      slug: edited.slug,
      title: { ru: 'Изменённая' },
      description: { ru: 'Описание' },
      coverId: cover,
      published: true,
      order: 7,
    });
  });

  it('moves the collection to a free slug, refuses the slug of another one (409 slugTaken)', async () => {
    strictEqual((await update(edited.id, input({ slug: fixtures.slug('renamed') }))).status, 200);
    const taken = await update<ApiErrorResponse>(edited.id, input({ slug: other.slug }));
    strictEqual(taken.status, 409);
    strictEqual(taken.body.key, 'admin.errors.slugTaken');
  });

  it('refuses a deleted cover (400 missingMedia)', async () => {
    const response = await update<ApiErrorResponse>(
      edited.id,
      input({ slug: fixtures.slug('renamed'), coverId: randomUUID() }),
    );
    strictEqual(response.status, 400);
    strictEqual(response.body.key, 'admin.errors.missingMedia');
  });

  it('answers 404 notFound for a deleted collection and 400 invalidId for a malformed id', async () => {
    const missing = await update<ApiErrorResponse>(randomUUID(), input({ slug: fixtures.slug('ghost') }));
    strictEqual(missing.status, 404);
    deepStrictEqual(missing.body, { statusCode: 404, error: 'notFound', key: 'admin.errors.notFound' });
    const malformed = await update<ApiErrorResponse>('seed-collection-1', input());
    strictEqual(malformed.status, 400);
    deepStrictEqual(malformed.body, { statusCode: 400, error: 'badRequest', key: 'admin.errors.invalidId' });
  });
});
