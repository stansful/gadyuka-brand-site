import { deepStrictEqual } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import type { ContentEntitySaved } from '~shared/contracts/content-entities';
import type { ApiErrorResponse } from '~shared/contracts/errors';

import { TestAdmin } from '~test/e2e/test-admin';
import { TestApp } from '~test/e2e/test-app';
import { ContentTestRows } from '~usecases/admin/content/common/test/content-test-rows';

import { MENU_ITEM_UPDATE_ROUTE } from './menu-item-update.route';

describe('[e2e] PUT /api/v1/admin/menu-items/:id', () => {
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

  const form = {
    label: { ru: 'Стало' },
    href: 'https://t.me/gadyuka',
    showInHeader: false,
    showInFooter: false,
    published: false,
  };

  function save<T = ContentEntitySaved>(id: string, body: unknown) {
    return app.api.put<T>(MENU_ITEM_UPDATE_ROUTE.replace(':id', id), { body, accessToken });
  }

  it('saves the form; the place in the menu stays', async () => {
    const { id } = await app.database.client.menuItem.create({
      data: { label: { ru: 'Было' }, href: '#a', order: 6 },
      select: { id: true },
    });
    rows.track('menuItem', id);
    deepStrictEqual((await save(id, form)).body, { id });
    const stored = await app.database.client.menuItem.findUniqueOrThrow({ where: { id } });
    deepStrictEqual(
      [stored.label, stored.href, stored.showInHeader, stored.showInFooter, stored.published, stored.order],
      [{ ru: 'Стало' }, 'https://t.me/gadyuka', false, false, false, 6],
    );
  });

  it('answers notFound and invalidId', async () => {
    deepStrictEqual((await save<ApiErrorResponse>(randomUUID(), form)).body.key, 'admin.errors.notFound');
    deepStrictEqual((await save<ApiErrorResponse>('x', form)).body.key, 'admin.errors.invalidId');
  });
});
