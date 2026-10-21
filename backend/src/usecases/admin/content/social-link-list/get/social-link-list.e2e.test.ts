import { deepStrictEqual } from 'node:assert';
import { after, before, describe, it } from 'node:test';

import type { AdminSocialLinkListResponse } from '~shared/contracts/content-entities';

import { TestAdmin } from '~test/e2e/test-admin';
import { TestApp } from '~test/e2e/test-app';
import { ContentTestRows } from '~usecases/admin/content/common/test/content-test-rows';

import { SOCIAL_LINK_LIST_ROUTE } from './social-link-list.route';

describe('[e2e] GET /api/v1/admin/social-links', () => {
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

  it('lists the links in the manual order and flags placeholder links without a profile', async () => {
    const created = await app.database.client.socialLink.createManyAndReturn({
      data: [
        { type: 'VK', url: 'https://vk.com/gadyuka', label: { ru: 'ВКонтакте' }, order: 2, published: false },
        { type: 'TELEGRAM', url: 'https://t.me/', order: 1 },
      ],
      select: { id: true },
    });
    const ids = created.map(row => rows.track('socialLink', row.id));
    const response = await app.api.get<AdminSocialLinkListResponse>(SOCIAL_LINK_LIST_ROUTE, { accessToken });
    const mine = response.body.items.filter(item => ids.includes(item.id));
    deepStrictEqual(
      mine.map(({ type, url, label, bareUrl, published }) => [type, url, label, bareUrl, published]),
      [
        ['TELEGRAM', 'https://t.me/', {}, true, true],
        ['VK', 'https://vk.com/gadyuka', { ru: 'ВКонтакте' }, false, false],
      ],
    );
  });
});
