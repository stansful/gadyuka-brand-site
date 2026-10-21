import { deepStrictEqual } from 'node:assert';
import { after, before, describe, it } from 'node:test';

import type { AdminMenuItemListResponse } from '~shared/contracts/content-entities';

import { TestAdmin } from '~test/e2e/test-admin';
import { TestApp } from '~test/e2e/test-app';
import { ContentTestRows } from '~usecases/admin/content/common/test/content-test-rows';

import { MENU_ITEM_LIST_ROUTE } from './menu-item-list.route';

describe('[e2e] GET /api/v1/admin/menu-items', () => {
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

  it('lists the menu in the manual order with the placement flags', async () => {
    const created = await app.database.client.menuItem.createManyAndReturn({
      data: [
        { label: { ru: 'Контакты' }, href: '#contacts', showInHeader: false, order: 2 },
        { label: { ru: 'Каталог', en: 'Catalog' }, href: '#catalog', showInFooter: false, order: 1, published: false },
      ],
      select: { id: true },
    });
    const ids = created.map(row => rows.track('menuItem', row.id));
    const response = await app.api.get<AdminMenuItemListResponse>(MENU_ITEM_LIST_ROUTE, { accessToken });
    const mine = response.body.items.filter(item => ids.includes(item.id));
    deepStrictEqual(
      mine.map(({ label, href, showInHeader, showInFooter, published }) => [
        label,
        href,
        showInHeader,
        showInFooter,
        published,
      ]),
      [
        [{ ru: 'Каталог', en: 'Catalog' }, '#catalog', true, false, false],
        [{ ru: 'Контакты' }, '#contacts', false, true, true],
      ],
    );
  });
});
