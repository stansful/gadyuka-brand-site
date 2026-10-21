import { deepStrictEqual } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import type { ContentEntitySaved } from '~shared/contracts/content-entities';
import type { ApiErrorResponse } from '~shared/contracts/errors';

import { TestAdmin } from '~test/e2e/test-admin';
import { TestApp } from '~test/e2e/test-app';
import { ContentTestRows } from '~usecases/admin/content/common/test/content-test-rows';

import { SOCIAL_LINK_UPDATE_ROUTE } from './social-link-update.route';

describe('[e2e] PUT /api/v1/admin/social-links/:id', () => {
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

  const form = { type: 'VK', url: 'https://vk.com/gadyuka', label: { ru: 'Сообщество' }, published: false };

  function save<T = ContentEntitySaved>(id: string, body: unknown) {
    return app.api.put<T>(SOCIAL_LINK_UPDATE_ROUTE.replace(':id', id), { body, accessToken });
  }

  it('saves the form; the place in the list stays', async () => {
    const { id } = await app.database.client.socialLink.create({
      data: { type: 'TELEGRAM', url: 'https://t.me/', order: 8 },
      select: { id: true },
    });
    rows.track('socialLink', id);
    deepStrictEqual((await save(id, form)).body, { id });
    const stored = await app.database.client.socialLink.findUniqueOrThrow({ where: { id } });
    deepStrictEqual(
      [stored.type, stored.url, stored.label, stored.published, stored.order],
      ['VK', 'https://vk.com/gadyuka', { ru: 'Сообщество' }, false, 8],
    );
  });

  it('answers notFound and invalidId', async () => {
    deepStrictEqual((await save<ApiErrorResponse>(randomUUID(), form)).body.key, 'admin.errors.notFound');
    deepStrictEqual((await save<ApiErrorResponse>('x', form)).body.key, 'admin.errors.invalidId');
  });
});
