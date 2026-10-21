import { deepStrictEqual } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import type { AdminPartnerDetails } from '~shared/contracts/content-entities';
import type { ApiErrorResponse } from '~shared/contracts/errors';

import { TestAdmin } from '~test/e2e/test-admin';
import { TestApp } from '~test/e2e/test-app';
import { ContentTestRows } from '~usecases/admin/content/common/test/content-test-rows';

import { PARTNER_DETAILS_ROUTE } from './partner-details.route';

describe('[e2e] GET /api/v1/admin/partners/:id', () => {
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

  function read<T = AdminPartnerDetails>(id: string) {
    return app.api.get<T>(PARTNER_DETAILS_ROUTE.replace(':id', id), { accessToken });
  }

  it('answers the edit form of a partner', async () => {
    const { id } = await app.database.client.partner.create({
      data: { name: 'Бренд', url: 'https://example.ru', description: { en: 'About' } },
      select: { id: true },
    });
    rows.track('partner', id);
    deepStrictEqual((await read(id)).body, {
      id,
      name: 'Бренд',
      url: 'https://example.ru',
      logo: null,
      description: { en: 'About' },
      published: false,
    });
  });

  it('answers 404 notFound and 400 invalidId', async () => {
    deepStrictEqual((await read<ApiErrorResponse>(randomUUID())).body.key, 'admin.errors.notFound');
    deepStrictEqual((await read<ApiErrorResponse>('x')).body.key, 'admin.errors.invalidId');
  });
});
