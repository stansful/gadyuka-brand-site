import { deepStrictEqual, strictEqual } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import type { AdminCatalogRowSaved, AdminProductSaveRequest } from '~shared/contracts/catalog';
import type { ApiErrorResponse } from '~shared/contracts/errors';

import { TestAdmin } from '~test/e2e/test-admin';
import { TestApp } from '~test/e2e/test-app';
import { CatalogFixtures, FixtureCollection } from '~usecases/admin/catalog/common/test/catalog-fixtures';

import { PRODUCT_UPDATE_ROUTE } from './product-update.route';

describe('[e2e] PUT /api/v1/admin/products/:id', () => {
  let app: TestApp;
  let admin: TestAdmin;
  let accessToken: string;
  let fixtures: CatalogFixtures;
  let home: FixtureCollection;
  let target: FixtureCollection;
  let media: readonly [string, string, string];

  before(async () => {
    app = await TestApp.start();
    admin = await TestAdmin.create(app.database);
    accessToken = await admin.signIn(app.api);
    fixtures = new CatalogFixtures(app.database, admin.id);
    home = await fixtures.createCollection('home');
    target = await fixtures.createCollection('target', 1);
    media = [await fixtures.createMedia(), await fixtures.createMedia(), await fixtures.createMedia()];
  });

  after(async () => {
    await fixtures.remove();
    await admin.remove();
    await app.stop();
  });

  function input(name: string, overrides: Partial<AdminProductSaveRequest> = {}): AdminProductSaveRequest {
    const texts = { title: { ru: name }, description: { ru: 'Описание' }, details: {} };
    const rest = { price: 1000, imageIds: [], published: true };
    return { slug: fixtures.slug(name), collectionId: home.id, ...texts, ...rest, ...overrides };
  }

  function update<T = AdminCatalogRowSaved>(id: string, body: unknown) {
    return app.api.put<T>(PRODUCT_UPDATE_ROUTE.replace(':id', id), { body, accessToken });
  }

  async function stateOf(productId: string) {
    const product = await app.database.client.product.findUniqueOrThrow({
      where: { id: productId },
      select: {
        collectionId: true,
        order: true,
        images: { orderBy: { order: 'asc' }, select: { mediaId: true, order: true } },
      },
    });
    return { collectionId: product.collectionId, order: product.order, images: product.images };
  }

  it('syncs the photos with the order of imageIds: removed, kept and added (200 { id })', async () => {
    const [m1, m2, m3] = media;
    const id = await fixtures.createProduct(home.id, 'photos', 3);
    strictEqual((await update(id, input('photos', { imageIds: [m1, m2] }))).status, 200);
    const response = await update(id, input('photos', { imageIds: [m3, m1] }));
    deepStrictEqual([response.status, response.body], [200, { id }]);
    deepStrictEqual(await stateOf(id), {
      collectionId: home.id,
      order: 3,
      images: [
        { mediaId: m3, order: 0 },
        { mediaId: m1, order: 1 },
      ],
    });
    await update(id, input('photos', { imageIds: [] }));
    deepStrictEqual((await stateOf(id)).images, []);
  });

  it('puts a product moved to another collection last there', async () => {
    await fixtures.createProduct(target.id, 'resident', 6);
    const id = await fixtures.createProduct(home.id, 'mover', 2);
    strictEqual((await update(id, input('mover', { collectionId: target.id }))).status, 200);
    deepStrictEqual(await stateOf(id), { collectionId: target.id, order: 7, images: [] });
  });

  it('keeps its own slug, refuses the slug of another product (409 slugTaken)', async () => {
    const id = await fixtures.createProduct(home.id, 'keeper');
    await fixtures.createProduct(home.id, 'neighbour');
    strictEqual((await update(id, input('keeper'))).status, 200);
    const taken = await update<ApiErrorResponse>(id, input('neighbour'));
    deepStrictEqual([taken.status, taken.body.key], [409, 'admin.errors.slugTaken']);
  });

  it('answers 404 admin.products.notFound for a deleted product, 400 invalidId for a malformed id', async () => {
    const missing = await update<ApiErrorResponse>(randomUUID(), input('ghost'));
    deepStrictEqual(missing.body, { statusCode: 404, error: 'notFound', key: 'admin.products.notFound' });
    strictEqual(await app.database.client.product.count({ where: { slug: fixtures.slug('ghost') } }), 0);
    const malformed = await update<ApiErrorResponse>('seed-product-1', input('ghost'));
    deepStrictEqual([malformed.status, malformed.body.key], [400, 'admin.errors.invalidId']);
  });

  it('refuses a deleted photo and a deleted collection', async () => {
    const id = await fixtures.createProduct(home.id, 'refused');
    const photo = await update<ApiErrorResponse>(id, input('refused', { imageIds: [randomUUID()] }));
    deepStrictEqual([photo.status, photo.body.key], [400, 'admin.errors.missingMedia']);
    const collection = await update<ApiErrorResponse>(id, input('refused', { collectionId: randomUUID() }));
    deepStrictEqual([collection.status, collection.body.key], [400, 'admin.products.collectionNotFound']);
  });
});
