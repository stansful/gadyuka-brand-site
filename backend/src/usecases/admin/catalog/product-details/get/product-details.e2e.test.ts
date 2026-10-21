import { deepStrictEqual, strictEqual } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import type { AdminProductDetailsResponse } from '~shared/contracts/catalog';
import type { ApiErrorResponse } from '~shared/contracts/errors';

import { TestAdmin } from '~test/e2e/test-admin';
import { TestApp } from '~test/e2e/test-app';
import { CatalogFixtures } from '~usecases/admin/catalog/common/test/catalog-fixtures';

import { PRODUCT_DETAILS_ROUTE } from './product-details.route';

describe('[e2e] GET /api/v1/admin/products/:id', () => {
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

  function details<T = AdminProductDetailsResponse>(id: string) {
    return app.api.get<T>(PRODUCT_DETAILS_ROUTE.replace(':id', id), { accessToken });
  }

  it('answers the edit form with the photos in display order', async () => {
    const [main, extra] = [await fixtures.createMedia({ ru: 'Главное' }), await fixtures.createMedia()];
    const collection = await fixtures.createCollection('collection');
    const id = await fixtures.createProduct(collection.id, 'hoodie');
    await app.database.client.product.update({
      where: { id },
      data: { details: { ru: 'Хлопок' }, price: 0, published: true },
    });
    await app.database.client.productImage.createMany({
      data: [
        { productId: id, mediaId: extra, order: 1 },
        { productId: id, mediaId: main, order: 0 },
      ],
    });
    const response = await details(id);
    strictEqual(response.status, 200);
    const { images, ...fields } = response.body;
    deepStrictEqual(fields, {
      id,
      slug: fixtures.slug('hoodie'),
      collectionId: collection.id,
      title: { ru: 'hoodie' },
      description: {},
      details: { ru: 'Хлопок' },
      price: 0,
      published: true,
    });
    deepStrictEqual(
      images.map(image => [image.id, image.alt]),
      [
        [main, { ru: 'Главное' }],
        [extra, { ru: 'Фото' }],
      ],
    );
  });

  it('answers 404 notFound for an unknown id and 400 invalidId for a malformed one', async () => {
    const missing = await details<ApiErrorResponse>(randomUUID());
    deepStrictEqual([missing.status, missing.body.key], [404, 'admin.errors.notFound']);
    const malformed = await details<ApiErrorResponse>('42');
    deepStrictEqual([malformed.status, malformed.body.key], [400, 'admin.errors.invalidId']);
  });
});
