import { deepStrictEqual } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import type { AdminOfferDetails } from '~shared/contracts/content-entities';
import type { ApiErrorResponse } from '~shared/contracts/errors';

import { TestAdmin } from '~test/e2e/test-admin';
import { TestApp } from '~test/e2e/test-app';
import { ContentTestRows } from '~usecases/admin/content/common/test/content-test-rows';

import { OFFER_DETAILS_ROUTE } from './offer-details.route';

describe('[e2e] GET /api/v1/admin/offers/:id', () => {
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

  function read<T = AdminOfferDetails>(id: string) {
    return app.api.get<T>(OFFER_DETAILS_ROUTE.replace(':id', id), { accessToken });
  }

  it('answers the edit form with the last day as a Moscow day', async () => {
    const image = await rows.createMedia();
    const { id } = await app.database.client.offer.create({
      data: {
        title: { ru: 'Скидка' },
        text: { en: 'Text' },
        ctaLabel: { ru: 'Купить' },
        ctaHref: '#contacts',
        validUntil: new Date('2026-10-31T20:59:59.999Z'),
        imageId: image.id,
      },
      select: { id: true },
    });
    rows.track('offer', id);
    deepStrictEqual((await read(id)).body, {
      id,
      title: { ru: 'Скидка' },
      text: { en: 'Text' },
      badge: {},
      ctaLabel: { ru: 'Купить' },
      ctaHref: '#contacts',
      validUntil: '2026-10-31',
      image,
      published: false,
    });
  });

  it('answers 404 notFound and 400 invalidId', async () => {
    deepStrictEqual((await read<ApiErrorResponse>(randomUUID())).body.key, 'admin.errors.notFound');
    deepStrictEqual((await read<ApiErrorResponse>('x')).body.key, 'admin.errors.invalidId');
  });
});
