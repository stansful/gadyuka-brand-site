import { deepStrictEqual, strictEqual } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import type { EntityPublishedResponse } from '~shared/contracts/entities';
import type { ApiErrorResponse, ApiValidationErrorResponse } from '~shared/contracts/errors';

import { TestAdmin } from '~test/e2e/test-admin';
import { TestApp } from '~test/e2e/test-app';
import { EntityFixtures } from '~usecases/admin/entities/common/test/entity-fixtures';

import { ENTITY_PUBLISHED_ROUTE } from './entity-published.route';

describe('[e2e] PATCH /api/v1/admin/entities/:kind/:id/published', () => {
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

  function setPublished<T = EntityPublishedResponse>(kind: string, id: string, body: unknown) {
    const path = ENTITY_PUBLISHED_ROUTE.replace(':kind', kind).replace(':id', id);
    return app.api.patch<T>(path, { body, accessToken });
  }

  it('publishes and hides a row of every kind it is given (collection, news)', async () => {
    const [collectionId] = fixtures.rows.collectionIds;
    const published = await setPublished('collection', collectionId, { published: true });
    strictEqual(published.status, 200);
    deepStrictEqual(published.body, { id: collectionId, published: true });
    strictEqual((await setPublished('news', fixtures.rows.newsId, { published: true })).status, 200);
    strictEqual((await setPublished('news', fixtures.rows.newsId, { published: false })).status, 200);
    const rows = await Promise.all([
      app.database.client.collection.findUniqueOrThrow({ where: { id: collectionId }, select: { published: true } }),
      app.database.client.newsItem.findUniqueOrThrow({
        where: { id: fixtures.rows.newsId },
        select: { published: true },
      }),
    ]);
    deepStrictEqual(rows, [{ published: true }, { published: false }]);
  });

  it('answers 404 notFound for a row that does not exist (or of another kind)', async () => {
    for (const [kind, id] of [
      ['product', randomUUID()],
      ['menuItem', fixtures.rows.newsId],
    ] as const) {
      const response = await setPublished<ApiErrorResponse>(kind, id, { published: true });
      strictEqual(response.status, 404, kind);
      deepStrictEqual(response.body, { statusCode: 404, error: 'notFound', key: 'admin.errors.notFound' });
    }
  });

  it('refuses an unknown kind and a malformed id with field keys', async () => {
    const response = await setPublished<ApiValidationErrorResponse>('lead', 'not-a-uuid', { published: true });
    strictEqual(response.status, 400);
    deepStrictEqual(response.body.fields, {
      kind: { key: 'admin.errors.invalidRequest' },
      id: { key: 'admin.validation.idInvalid' },
    });
  });

  it('refuses a flag that is not a boolean, and extra fields', async () => {
    const response = await setPublished<ApiValidationErrorResponse>('news', fixtures.rows.newsId, {
      published: 'yes',
      order: 1,
    });
    strictEqual(response.status, 400);
    deepStrictEqual(response.body.fields, {
      published: { key: 'admin.validation.invalid' },
      order: { key: 'admin.validation.unknownField' },
    });
  });

  it('needs a signed-in admin', async () => {
    const path = ENTITY_PUBLISHED_ROUTE.replace(':kind', 'news').replace(':id', fixtures.rows.newsId);
    const response = await app.api.patch<ApiErrorResponse>(path, { body: { published: true } });
    strictEqual(response.status, 401);
  });
});
