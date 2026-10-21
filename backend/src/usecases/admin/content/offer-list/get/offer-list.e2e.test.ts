import { deepStrictEqual } from 'node:assert';
import { after, before, describe, it } from 'node:test';

import type { AdminOfferListResponse } from '~shared/contracts/content-entities';

import { TestAdmin } from '~test/e2e/test-admin';
import { TestApp } from '~test/e2e/test-app';
import { ContentTestRows } from '~usecases/admin/content/common/test/content-test-rows';

import { OFFER_LIST_ROUTE } from './offer-list.route';

describe('[e2e] GET /api/v1/admin/offers', () => {
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

  it('lists the offers in the manual order: the last day (Moscow), expired ones flagged', async () => {
    const created = await app.database.client.offer.createManyAndReturn({
      data: [
        { title: { ru: 'Бессрочно' }, order: 3 },
        { title: { ru: 'Истекло' }, badge: { ru: '−15%' }, validUntil: new Date('2020-01-31T20:59:59.999Z'), order: 1 },
        { title: { ru: 'Действует' }, validUntil: new Date('2100-12-31T20:59:59.999Z'), order: 2, published: true },
      ],
      select: { id: true },
    });
    const ids = created.map(row => rows.track('offer', row.id));
    const response = await app.api.get<AdminOfferListResponse>(OFFER_LIST_ROUTE, { accessToken });
    const mine = response.body.items.filter(item => ids.includes(item.id));
    deepStrictEqual(
      mine.map(({ title, badge, validUntil, expired, image, published }) => [
        title.ru,
        badge,
        validUntil,
        expired,
        image,
        published,
      ]),
      [
        ['Истекло', { ru: '−15%' }, '2020-01-31', true, null, false],
        ['Действует', {}, '2100-12-31', false, null, true],
        ['Бессрочно', {}, null, false, null, false],
      ],
    );
  });
});
