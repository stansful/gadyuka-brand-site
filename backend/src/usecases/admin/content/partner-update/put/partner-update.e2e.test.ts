import { deepStrictEqual } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import type { ContentEntitySaved } from '~shared/contracts/content-entities';
import type { ApiErrorResponse } from '~shared/contracts/errors';

import { TestAdmin } from '~test/e2e/test-admin';
import { TestApp } from '~test/e2e/test-app';
import { ContentTestRows } from '~usecases/admin/content/common/test/content-test-rows';

import { PARTNER_UPDATE_ROUTE } from './partner-update.route';

describe('[e2e] PUT /api/v1/admin/partners/:id', () => {
  let app: TestApp;
  let admin: TestAdmin;
  let accessToken: string;
  let rows: ContentTestRows;

  before(async () => {
    app = await TestApp.start();
    admin = await TestAdmin.create(app.database);
    accessToken = await admin.signIn(app.api);
    rows = new ContentTestRows(app.database, admin.id);
  });

  after(async () => {
    await rows.remove();
    await admin.remove();
    await app.stop();
  });

  const form = { name: 'Стало', url: null, logoId: null, description: {}, published: true };

  async function createPartner(): Promise<string> {
    const row = await app.database.client.partner.create({
      data: { name: 'Было', url: 'https://example.ru', order: 4 },
      select: { id: true },
    });
    return rows.track('partner', row.id);
  }

  function save<T = ContentEntitySaved>(id: string, body: unknown) {
    return app.api.put<T>(PARTNER_UPDATE_ROUTE.replace(':id', id), { body, accessToken });
  }

  it('saves the form (the link can be removed); the place stays', async () => {
    const id = await createPartner();
    const response = await save(id, form);
    deepStrictEqual([response.status, response.body], [200, { id }]);
    const stored = await app.database.client.partner.findUniqueOrThrow({ where: { id } });
    deepStrictEqual([stored.name, stored.url, stored.published, stored.order], ['Стало', null, true, 4]);
  });

  it('answers missingMedia, notFound and invalidId', async () => {
    const id = await createPartner();
    deepStrictEqual(
      (await save<ApiErrorResponse>(id, { ...form, logoId: randomUUID() })).body.key,
      'admin.errors.missingMedia',
    );
    deepStrictEqual((await save<ApiErrorResponse>(randomUUID(), form)).body.key, 'admin.errors.notFound');
    deepStrictEqual((await save<ApiErrorResponse>('x', form)).body.key, 'admin.errors.invalidId');
  });
});
