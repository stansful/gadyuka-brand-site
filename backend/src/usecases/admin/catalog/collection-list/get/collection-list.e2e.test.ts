import { deepStrictEqual, ok, strictEqual } from 'node:assert';
import { after, before, describe, it } from 'node:test';

import type { AdminCollectionListResponse } from '~shared/contracts/catalog';

import { TestAdmin } from '~test/e2e/test-admin';
import { TestApp } from '~test/e2e/test-app';
import { CatalogFixtures } from '~usecases/admin/catalog/common/test/catalog-fixtures';

import { COLLECTION_LIST_ROUTE } from './collection-list.route';

describe('[e2e] GET /api/v1/admin/collections', () => {
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

  it('lists the collections in the site order with cover and number of products', async () => {
    const cover = await fixtures.createMedia();
    const late = await fixtures.createCollection('late', 2);
    const early = await fixtures.createCollection('early', 1);
    await app.database.client.collection.update({ where: { id: early.id }, data: { coverId: cover, published: true } });
    await fixtures.createProduct(early.id, 'product');
    const response = await app.api.get<AdminCollectionListResponse>(COLLECTION_LIST_ROUTE, { accessToken });
    strictEqual(response.status, 200);
    const mine = response.body.items.filter(item => item.slug.startsWith(fixtures.tag));
    deepStrictEqual(
      mine.map(item => item.id),
      [early.id, late.id],
    );
    const [first, second] = mine;
    deepStrictEqual(
      [first?.title, first?.published, first?.cover?.id, first?.productCount],
      [{ ru: 'early' }, true, cover, 1],
    );
    deepStrictEqual([second?.cover, second?.productCount, second?.published], [null, 0, false]);
  });

  it('needs a signed-in admin', async () => {
    const response = await app.api.get(COLLECTION_LIST_ROUTE);
    strictEqual(response.status, 401);
    ok(!JSON.stringify(response.body).includes(fixtures.tag));
  });
});
