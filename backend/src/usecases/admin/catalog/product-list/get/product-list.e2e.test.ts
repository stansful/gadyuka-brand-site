import { deepStrictEqual, strictEqual } from 'node:assert';
import { after, before, describe, it } from 'node:test';

import type { AdminProductListResponse } from '~shared/contracts/catalog';

import { TestAdmin } from '~test/e2e/test-admin';
import { TestApp } from '~test/e2e/test-app';
import { CatalogFixtures } from '~usecases/admin/catalog/common/test/catalog-fixtures';

import { PRODUCT_LIST_ROUTE } from './product-list.route';

describe('[e2e] GET /api/v1/admin/products', () => {
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

  it('groups the products by collection, both in the site order, with the main photo and photo count', async () => {
    const [main, extra] = [await fixtures.createMedia(), await fixtures.createMedia()];
    const second = await fixtures.createCollection('second', 2);
    const first = await fixtures.createCollection('first', 1);
    const later = await fixtures.createProduct(first.id, 'later', 1);
    const sooner = await fixtures.createProduct(first.id, 'sooner', 0);
    await app.database.client.product.update({ where: { id: sooner }, data: { price: 12900, published: true } });
    await app.database.client.productImage.createMany({
      data: [
        { productId: sooner, mediaId: extra, order: 1 },
        { productId: sooner, mediaId: main, order: 0 },
      ],
    });
    const response = await app.api.get<AdminProductListResponse>(PRODUCT_LIST_ROUTE, { accessToken });
    strictEqual(response.status, 200);
    const mine = response.body.groups.filter(group => group.collection.slug.startsWith(fixtures.tag));
    deepStrictEqual(
      mine.map(group => [group.collection.id, group.products.map(product => product.id)]),
      [
        [first.id, [sooner, later]],
        [second.id, []],
      ],
    );
    const [product] = mine[0]?.products ?? [];
    deepStrictEqual(
      [product?.price, product?.published, product?.cover?.id, product?.imageCount, product?.title],
      [12900, true, main, 2, { ru: 'sooner' }],
    );
    deepStrictEqual(mine[0]?.collection, { id: first.id, slug: first.slug, title: { ru: 'first' }, published: false });
    deepStrictEqual([mine[0]?.products[1]?.cover, mine[0]?.products[1]?.price], [null, null]);
  });
});
