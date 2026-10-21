import { deepStrictEqual, strictEqual } from 'node:assert';
import { randomBytes } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import type { AdminMenuLinkTargetsResponse } from '~shared/contracts/content-entities';

import { TestAdmin } from '~test/e2e/test-admin';
import { TestApp } from '~test/e2e/test-app';

import { MENU_LINK_TARGETS_ROUTE } from './menu-link-targets.route';

describe('[e2e] GET /api/v1/admin/menu-items/link-targets', () => {
  let app: TestApp;
  let admin: TestAdmin;
  let accessToken: string;
  const collectionIds: string[] = [];

  before(async () => {
    app = await TestApp.start();
    admin = await TestAdmin.create(app.database);
    accessToken = await admin.signIn(app.api);
  });

  after(async () => {
    await app.database.client.collection.deleteMany({ where: { id: { in: collectionIds } } });
    await admin.remove();
    await app.stop();
  });

  it('answers every collection (published or not) in the catalog order', async () => {
    const tag = randomBytes(4).toString('hex');
    const created = await app.database.client.collection.createManyAndReturn({
      data: [
        { slug: `e2e-${tag}-b`, title: { ru: 'Вторая' }, order: 2, published: true },
        { slug: `e2e-${tag}-a`, title: { ru: 'Первая', en: 'First' }, order: 1 },
      ],
      select: { id: true },
    });
    collectionIds.push(...created.map(row => row.id));
    const response = await app.api.get<AdminMenuLinkTargetsResponse>(MENU_LINK_TARGETS_ROUTE, { accessToken });
    strictEqual(response.status, 200, 'not taken for GET /admin/menu-items/:id');
    deepStrictEqual(
      response.body.collections.filter(target => target.slug.startsWith(`e2e-${tag}`)),
      [
        { slug: `e2e-${tag}-a`, title: { ru: 'Первая', en: 'First' } },
        { slug: `e2e-${tag}-b`, title: { ru: 'Вторая' } },
      ],
    );
  });
});
