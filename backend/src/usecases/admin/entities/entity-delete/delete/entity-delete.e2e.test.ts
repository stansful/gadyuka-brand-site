import { deepStrictEqual, strictEqual } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import type { ApiErrorResponse, ApiValidationErrorResponse } from '~shared/contracts/errors';

import { TestAdmin } from '~test/e2e/test-admin';
import { TestApp } from '~test/e2e/test-app';
import { EntityFixtures } from '~usecases/admin/entities/common/test/entity-fixtures';

import { ENTITY_DELETE_ROUTE } from './entity-delete.route';

describe('[e2e] DELETE /api/v1/admin/entities/:kind/:id', () => {
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

  function remove<T = string>(kind: string, id: string) {
    return app.api.delete<T>(ENTITY_DELETE_ROUTE.replace(':kind', kind).replace(':id', id), { accessToken });
  }

  it('deletes a row (204), then answers 404 for it', async () => {
    strictEqual((await remove('menuItem', fixtures.rows.menuItemId)).status, 204);
    strictEqual(await app.database.client.menuItem.count({ where: { id: fixtures.rows.menuItemId } }), 0);
    const again = await remove<ApiErrorResponse>('menuItem', fixtures.rows.menuItemId);
    strictEqual(again.status, 404);
    strictEqual(again.body.key, 'admin.errors.notFound');
  });

  it('deletes a collection together with its products', async () => {
    const [collectionId] = fixtures.rows.collectionIds;
    strictEqual((await remove('collection', collectionId)).status, 204);
    strictEqual(await app.database.client.product.count({ where: { id: { in: [...fixtures.rows.productIds] } } }), 0);
    strictEqual(await app.database.client.product.count({ where: { id: fixtures.rows.otherProductId } }), 1);
  });

  it('deletes news too (not orderable, but publishable)', async () => {
    strictEqual((await remove('news', fixtures.rows.newsId)).status, 204);
    strictEqual((await remove<ApiErrorResponse>('news', randomUUID())).status, 404);
  });

  it('refuses an unknown kind and a malformed id', async () => {
    const response = await remove<ApiValidationErrorResponse>('media', '42');
    strictEqual(response.status, 400);
    deepStrictEqual(response.body.fields, {
      kind: { key: 'admin.errors.invalidRequest' },
      id: { key: 'admin.validation.idInvalid' },
    });
  });
});
