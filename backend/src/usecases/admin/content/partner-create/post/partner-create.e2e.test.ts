import { deepStrictEqual, ok, strictEqual } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import type { ContentEntitySaved } from '~shared/contracts/content-entities';
import type { ApiErrorResponse, ApiValidationErrorResponse } from '~shared/contracts/errors';

import { TestAdmin } from '~test/e2e/test-admin';
import { TestApp } from '~test/e2e/test-app';
import { ContentTestRows } from '~usecases/admin/content/common/test/content-test-rows';

import { PARTNER_CREATE_ROUTE } from './partner-create.route';

describe('[e2e] POST /api/v1/admin/partners', () => {
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

  async function create<T = ContentEntitySaved>(body: unknown) {
    const response = await app.api.post<T>(PARTNER_CREATE_ROUTE, { body, accessToken });
    if (response.status === 201) {
      rows.track('partner', (response.body as ContentEntitySaved).id);
    }
    return response;
  }

  it('adds the partner at the end: the name and link trimmed, the description normalized', async () => {
    const last = await app.database.client.partner.create({
      data: { name: 'Последний', order: 5000 },
      select: { id: true },
    });
    rows.track('partner', last.id);
    const logo = await rows.createMedia();
    const response = await create({
      name: '  Бренд ',
      url: ' https://example.ru ',
      logoId: logo.id,
      description: { ru: ' Описание ', en: '' },
      published: true,
    });
    strictEqual(response.status, 201);
    const stored = await app.database.client.partner.findUniqueOrThrow({ where: { id: response.body.id } });
    deepStrictEqual(
      [stored.name, stored.url, stored.logoId, stored.description, stored.published],
      ['Бренд', 'https://example.ru', logo.id, { ru: 'Описание' }, true],
    );
    ok(stored.order > 5000, `order ${stored.order} after the last partner`);
  });

  it('refuses an empty name and a non-http link; answers missingMedia for a gone logo', async () => {
    const invalid = await create<ApiValidationErrorResponse>({
      name: ' ',
      url: 'ftp://x',
      logoId: null,
      description: {},
      published: true,
    });
    deepStrictEqual(invalid.body.fields, {
      name: { key: 'admin.validation.nameRequired' },
      url: { key: 'admin.validation.httpUrl' },
    });
    const missing = await create<ApiErrorResponse>({
      name: 'Бренд',
      url: null,
      logoId: randomUUID(),
      description: {},
      published: true,
    });
    deepStrictEqual([missing.status, missing.body.key], [400, 'admin.errors.missingMedia']);
  });
});
