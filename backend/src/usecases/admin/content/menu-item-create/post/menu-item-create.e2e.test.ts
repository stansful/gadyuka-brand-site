import { deepStrictEqual, ok, strictEqual } from 'node:assert';
import { after, before, describe, it } from 'node:test';

import type { ContentEntitySaved } from '~shared/contracts/content-entities';
import type { ApiValidationErrorResponse } from '~shared/contracts/errors';

import { TestAdmin } from '~test/e2e/test-admin';
import { TestApp } from '~test/e2e/test-app';
import { ContentTestRows } from '~usecases/admin/content/common/test/content-test-rows';

import { MENU_ITEM_CREATE_ROUTE } from './menu-item-create.route';

describe('[e2e] POST /api/v1/admin/menu-items', () => {
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
    const response = await app.api.post<T>(MENU_ITEM_CREATE_ROUTE, { body, accessToken });
    if (response.status === 201) {
      rows.track('menuItem', (response.body as ContentEntitySaved).id);
    }
    return response;
  }

  it('adds the item at the end of the menu: label normalized, link trimmed', async () => {
    const last = await app.database.client.menuItem.create({
      data: { label: { ru: 'Последний' }, href: '#last', order: 5000 },
      select: { id: true },
    });
    rows.track('menuItem', last.id);
    const response = await create({
      label: { ru: ' Каталог ', en: '' },
      href: ' #catalog ',
      showInHeader: false,
      showInFooter: true,
      published: true,
    });
    strictEqual(response.status, 201);
    const stored = await app.database.client.menuItem.findUniqueOrThrow({ where: { id: response.body.id } });
    deepStrictEqual(
      [stored.label, stored.href, stored.showInHeader, stored.showInFooter, stored.published],
      [{ ru: 'Каталог' }, '#catalog', false, true, true],
    );
    ok(stored.order > 5000, `order ${stored.order} after the last item`);
  });

  it('refuses a bare "#" and a missing Russian label with field keys', async () => {
    const response = await create<ApiValidationErrorResponse>({
      label: { en: 'Catalog' },
      href: '#',
      showInHeader: true,
      showInFooter: true,
      published: true,
    });
    deepStrictEqual(response.body.fields, {
      'label.ru': { key: 'admin.validation.requiredText', values: { locale: 'ru' } },
      href: { key: 'admin.validation.hrefBareHash' },
    });
  });
});
