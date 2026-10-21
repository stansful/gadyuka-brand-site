import { deepStrictEqual, strictEqual } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import type { AdminCatalogRowSaved, AdminProductSaveRequest } from '~shared/contracts/catalog';
import type { ApiErrorResponse, ApiValidationErrorResponse } from '~shared/contracts/errors';

import { TestAdmin } from '~test/e2e/test-admin';
import { TestApp } from '~test/e2e/test-app';
import { CatalogFixtures, FixtureCollection } from '~usecases/admin/catalog/common/test/catalog-fixtures';

import { PRODUCT_CREATE_ROUTE } from './product-create.route';

describe('[e2e] POST /api/v1/admin/products', () => {
  let app: TestApp;
  let admin: TestAdmin;
  let accessToken: string;
  let fixtures: CatalogFixtures;
  let collection: FixtureCollection;

  before(async () => {
    app = await TestApp.start();
    admin = await TestAdmin.create(app.database);
    accessToken = await admin.signIn(app.api);
    fixtures = new CatalogFixtures(app.database, admin.id);
    collection = await fixtures.createCollection('collection');
  });

  after(async () => {
    await fixtures.remove();
    await admin.remove();
    await app.stop();
  });

  function input(name: string, overrides: Partial<AdminProductSaveRequest> = {}): AdminProductSaveRequest {
    const texts = { title: { ru: name }, description: {}, details: {} };
    const rest = { price: null, imageIds: [], published: false };
    return { slug: fixtures.slug(name), collectionId: collection.id, ...texts, ...rest, ...overrides };
  }

  function create<T = AdminCatalogRowSaved>(body: unknown) {
    return app.api.post<T>(PRODUCT_CREATE_ROUTE, { body, accessToken });
  }

  async function imagesOf(productId: string): Promise<Array<{ mediaId: string; order: number }>> {
    return app.database.client.productImage.findMany({
      where: { productId },
      orderBy: { order: 'asc' },
      select: { mediaId: true, order: true },
    });
  }

  it('creates the product with its photos in the given order, last in its collection (201 { id })', async () => {
    const [first, second] = [await fixtures.createMedia(), await fixtures.createMedia()];
    await fixtures.createProduct(collection.id, 'existing', 4);
    const response = await create(
      input('hoodie', {
        title: { ru: ' Худи ', en: '' },
        details: { ru: 'Хлопок\nОверсайз' },
        price: 12900,
        imageIds: [second, first],
      }),
    );
    strictEqual(response.status, 201);
    deepStrictEqual(await imagesOf(response.body.id), [
      { mediaId: second, order: 0 },
      { mediaId: first, order: 1 },
    ]);
    const row = await app.database.client.product.findUniqueOrThrow({
      where: { id: response.body.id },
      select: { title: true, details: true, price: true, order: true, collectionId: true },
    });
    deepStrictEqual(row, {
      title: { ru: 'Худи' },
      details: { ru: 'Хлопок\nОверсайз' },
      price: 12900,
      order: 5,
      collectionId: collection.id,
    });
  });

  it('starts an empty collection at position 0 and accepts a price on request', async () => {
    const empty = await fixtures.createCollection('empty');
    const response = await create(input('first-in-empty', { collectionId: empty.id }));
    strictEqual(response.status, 201);
    const row = await app.database.client.product.findUniqueOrThrow({
      where: { id: response.body.id },
      select: { order: true, price: true },
    });
    deepStrictEqual(row, { order: 0, price: null });
  });

  it('checks the slug, then the collection, then the photos', async () => {
    await create(input('taken'));
    const gone = randomUUID();
    const cases: ReadonlyArray<readonly [AdminProductSaveRequest, number, string]> = [
      [input('taken', { collectionId: randomUUID(), imageIds: [gone] }), 409, 'admin.errors.slugTaken'],
      [input('free', { collectionId: randomUUID(), imageIds: [gone] }), 400, 'admin.products.collectionNotFound'],
      [input('free', { imageIds: [gone] }), 400, 'admin.errors.missingMedia'],
    ];
    for (const [body, status, key] of cases) {
      const response = await create<ApiErrorResponse>(body);
      deepStrictEqual([response.status, response.body.key], [status, key]);
    }
    strictEqual(await app.database.client.product.count({ where: { slug: fixtures.slug('free') } }), 0);
  });

  it('refuses an invalid form with field keys', async () => {
    const response = await create<ApiValidationErrorResponse>({
      ...input('bad'),
      price: 100_000_001,
      imageIds: Array.from({ length: 31 }, () => randomUUID()),
      collectionId: '',
    });
    strictEqual(response.status, 400);
    deepStrictEqual(response.body.fields, {
      collectionId: { key: 'admin.validation.idRequired' },
      price: { key: 'admin.validation.priceTooHigh', values: { max: 100_000_000 } },
      imageIds: { key: 'admin.validation.photosTooMany', values: { max: 30 } },
    });
  });
});
