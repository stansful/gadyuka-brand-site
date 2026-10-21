import { deepStrictEqual, strictEqual } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import type { ApiErrorResponse, ApiValidationErrorResponse } from '~shared/contracts/errors';

import { TestAdmin } from '~test/e2e/test-admin';
import { TestApp } from '~test/e2e/test-app';
import { EntityFixtures } from '~usecases/admin/entities/common/test/entity-fixtures';

import { ENTITY_ORDER_ROUTE } from './entity-order.route';

describe('[e2e] POST /api/v1/admin/entities/:kind/reorder', () => {
  let app: TestApp;
  let admin: TestAdmin;
  let accessToken: string;
  let fixtures: EntityFixtures;

  before(async () => {
    app = await TestApp.start();
    admin = await TestAdmin.create(app.database);
    accessToken = await admin.signIn(app.api);
    fixtures = await EntityFixtures.create(app.database);
  });

  after(async () => {
    await fixtures.remove();
    await admin.remove();
    await app.stop();
  });

  function reorder<T = string>(kind: string, ids: unknown) {
    return app.api.post<T>(ENTITY_ORDER_ROUTE.replace(':kind', kind), { body: { ids }, accessToken });
  }

  async function productOrder(): Promise<Record<string, number>> {
    const rows = await app.database.client.product.findMany({
      where: { id: { in: [...fixtures.rows.productIds] } },
      select: { id: true, order: true },
    });
    return Object.fromEntries(rows.map(row => [row.id, row.order]));
  }

  it('saves the order of a list: ids[i] gets order i (204)', async () => {
    const [first, second] = fixtures.rows.productIds;
    const response = await reorder('product', [second, first]);
    strictEqual(response.status, 204);
    deepStrictEqual(await productOrder(), { [second]: 0, [first]: 1 });
    const [collectionA, collectionB] = fixtures.rows.collectionIds;
    strictEqual((await reorder('collection', [collectionB, collectionA])).status, 204);
  });

  it('orders products only within their collection (400 invalidOrder)', async () => {
    const response = await reorder<ApiErrorResponse>('product', [
      ...fixtures.rows.productIds,
      fixtures.rows.otherProductId,
    ]);
    strictEqual(response.status, 400);
    deepStrictEqual(response.body, { statusCode: 400, error: 'badRequest', key: 'admin.entities.invalidOrder' });
  });

  it('answers 404 when a row of the list is gone, and changes nothing', async () => {
    const before = await productOrder();
    const response = await reorder<ApiErrorResponse>('product', [...fixtures.rows.productIds, randomUUID()]);
    strictEqual(response.status, 404);
    strictEqual(response.body.key, 'admin.errors.notFound');
    deepStrictEqual(await productOrder(), before);
  });

  it('refuses news (ordered by date), repeated ids, an empty list and malformed ids', async () => {
    const [id] = fixtures.rows.productIds;
    const cases: ReadonlyArray<readonly [string, unknown, Record<string, { key: string }>]> = [
      ['news', [fixtures.rows.newsId], { kind: { key: 'admin.errors.invalidRequest' } }],
      ['product', [id, id], { ids: { key: 'admin.validation.listDuplicate' } }],
      ['product', [], { ids: { key: 'admin.entities.invalidOrder' } }],
      ['product', 'x', { ids: { key: 'admin.entities.invalidOrder' } }],
      ['product', ['not-a-uuid'], { ids: { key: 'admin.validation.idInvalid' } }],
    ];
    for (const [kind, ids, fields] of cases) {
      const response = await reorder<ApiValidationErrorResponse>(kind, ids);
      strictEqual(response.status, 400, JSON.stringify(ids));
      deepStrictEqual(response.body.fields, fields, JSON.stringify(ids));
    }
  });
});
