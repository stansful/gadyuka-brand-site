import { deepStrictEqual } from 'node:assert';
import { after, before, describe, it } from 'node:test';

import type { AdminPartnerListResponse } from '~shared/contracts/content-entities';

import { TestAdmin } from '~test/e2e/test-admin';
import { TestApp } from '~test/e2e/test-app';
import { ContentTestRows } from '~usecases/admin/content/common/test/content-test-rows';

import { PARTNER_LIST_ROUTE } from './partner-list.route';

describe('[e2e] GET /api/v1/admin/partners', () => {
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

  it('lists the partners in the manual order with logo, link and description', async () => {
    const logo = await rows.createMedia();
    const created = await app.database.client.partner.createManyAndReturn({
      data: [
        { name: 'Второй', order: 2 },
        {
          name: 'Первый',
          url: 'https://example.ru',
          logoId: logo.id,
          description: { ru: 'Описание' },
          order: 1,
          published: true,
        },
      ],
      select: { id: true },
    });
    const ids = created.map(row => rows.track('partner', row.id));
    const response = await app.api.get<AdminPartnerListResponse>(PARTNER_LIST_ROUTE, { accessToken });
    const mine = response.body.items.filter(item => ids.includes(item.id));
    deepStrictEqual(
      mine.map(({ name, url, logo: partnerLogo, description, published }) => [
        name,
        url,
        partnerLogo,
        description,
        published,
      ]),
      [
        ['Первый', 'https://example.ru', logo, { ru: 'Описание' }, true],
        ['Второй', null, null, {}, false],
      ],
    );
  });
});
