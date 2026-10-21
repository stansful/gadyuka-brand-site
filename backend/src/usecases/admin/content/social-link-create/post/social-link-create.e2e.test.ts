import { deepStrictEqual, ok, strictEqual } from 'node:assert';
import { after, before, describe, it } from 'node:test';

import type { ContentEntitySaved } from '~shared/contracts/content-entities';
import type { ApiValidationErrorResponse } from '~shared/contracts/errors';

import { TestAdmin } from '~test/e2e/test-admin';
import { TestApp } from '~test/e2e/test-app';
import { ContentTestRows } from '~usecases/admin/content/common/test/content-test-rows';

import { SOCIAL_LINK_CREATE_ROUTE } from './social-link-create.route';

describe('[e2e] POST /api/v1/admin/social-links', () => {
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
    const response = await app.api.post<T>(SOCIAL_LINK_CREATE_ROUTE, { body, accessToken });
    if (response.status === 201) {
      rows.track('socialLink', (response.body as ContentEntitySaved).id);
    }
    return response;
  }

  it('adds the link at the end: the url trimmed, an empty label stored as {}', async () => {
    const last = await app.database.client.socialLink.create({
      data: { type: 'OTHER', url: 'https://example.ru', order: 5000 },
      select: { id: true },
    });
    rows.track('socialLink', last.id);
    const response = await create({
      type: 'TELEGRAM',
      url: ' https://t.me/gadyuka ',
      label: { ru: ' ', en: '' },
      published: true,
    });
    strictEqual(response.status, 201);
    const stored = await app.database.client.socialLink.findUniqueOrThrow({ where: { id: response.body.id } });
    deepStrictEqual(
      [stored.type, stored.url, stored.label, stored.published],
      ['TELEGRAM', 'https://t.me/gadyuka', {}, true],
    );
    ok(stored.order > 5000, `order ${stored.order} after the last link`);
  });

  it('refuses an unknown type and a non-http link with field keys', async () => {
    const response = await create<ApiValidationErrorResponse>({
      type: 'telegram',
      url: 'ftp://x',
      label: {},
      published: true,
    });
    deepStrictEqual(response.body.fields, {
      type: { key: 'admin.validation.socialType' },
      url: { key: 'admin.validation.httpUrl' },
    });
  });
});
