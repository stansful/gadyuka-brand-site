import { deepStrictEqual, strictEqual } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import type { AdminCollectionDetailsResponse } from '~shared/contracts/catalog';
import type { ApiErrorResponse } from '~shared/contracts/errors';

import { TestAdmin } from '~test/e2e/test-admin';
import { TestApp } from '~test/e2e/test-app';
import { CatalogFixtures } from '~usecases/admin/catalog/common/test/catalog-fixtures';

import { COLLECTION_DETAILS_ROUTE } from './collection-details.route';

describe('[e2e] GET /api/v1/admin/collections/:id', () => {
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

  function details<T = AdminCollectionDetailsResponse>(id: string) {
    return app.api.get<T>(COLLECTION_DETAILS_ROUTE.replace(':id', id), { accessToken });
  }

  it('answers the edit form: texts, cover (with its alt texts), publish flag, number of products', async () => {
    const cover = await fixtures.createMedia({ ru: 'Обложка', de: 'ignored' });
    const collection = await fixtures.createCollection('details');
    await app.database.client.collection.update({
      where: { id: collection.id },
      data: { description: { ru: 'Описание', en: 'About', xx: 1 }, coverId: cover, published: true },
    });
    await fixtures.createProduct(collection.id, 'p1');
    await fixtures.createProduct(collection.id, 'p2', 1);
    const response = await details(collection.id);
    strictEqual(response.status, 200);
    const media = await app.database.client.media.findUniqueOrThrow({ where: { id: cover }, select: { url: true } });
    deepStrictEqual(response.body, {
      id: collection.id,
      slug: collection.slug,
      title: { ru: 'details' },
      description: { ru: 'Описание', en: 'About' },
      cover: { id: cover, url: media.url, width: 1200, height: 800, alt: { ru: 'Обложка' } },
      published: true,
      productCount: 2,
    });
  });

  it('answers 404 notFound for an unknown id and 400 invalidId for a malformed one', async () => {
    const missing = await details<ApiErrorResponse>(randomUUID());
    deepStrictEqual([missing.status, missing.body.key], [404, 'admin.errors.notFound']);
    const malformed = await details<ApiErrorResponse>('abc');
    deepStrictEqual([malformed.status, malformed.body.key], [400, 'admin.errors.invalidId']);
  });
});
