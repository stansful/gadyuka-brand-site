import { deepStrictEqual } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import type { ContentEntitySaved } from '~shared/contracts/content-entities';
import type { ApiErrorResponse } from '~shared/contracts/errors';

import { TestAdmin } from '~test/e2e/test-admin';
import { TestApp } from '~test/e2e/test-app';
import { ContentTestRows } from '~usecases/admin/content/common/test/content-test-rows';

import { OFFER_UPDATE_ROUTE } from './offer-update.route';

describe('[e2e] PUT /api/v1/admin/offers/:id', () => {
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
    title: { ru: 'Стало' },
    text: {},
    badge: {},
    ctaLabel: {},
    ctaHref: null,
    validUntil: null,
    imageId: null,
    published: true,
  };

  async function createOffer(): Promise<string> {
    const row = await app.database.client.offer.create({
      data: { title: { ru: 'Было' }, ctaLabel: { ru: 'Купить' }, ctaHref: '#a', validUntil: new Date(), order: 3 },
      select: { id: true },
    });
    return rows.track('offer', row.id);
  }

  function save<T = ContentEntitySaved>(id: string, body: unknown) {
    return app.api.put<T>(OFFER_UPDATE_ROUTE.replace(':id', id), { body, accessToken });
  }

  it('saves the form: the button and the end date can be cleared, the place stays', async () => {
    const id = await createOffer();
    const response = await save(id, form);
    deepStrictEqual([response.status, response.body], [200, { id }]);
    const stored = await app.database.client.offer.findUniqueOrThrow({ where: { id } });
    deepStrictEqual(
      [stored.title, stored.ctaLabel, stored.ctaHref, stored.validUntil, stored.published, stored.order],
      [{ ru: 'Стало' }, {}, null, null, true, 3],
    );
  });

  it('answers ctaHrefRequired, notFound and invalidId', async () => {
    const id = await createOffer();
    const noLink = await save<ApiErrorResponse>(id, { ...form, ctaLabel: { ru: 'Купить' } });
    deepStrictEqual([noLink.status, noLink.body.key], [400, 'admin.offers.ctaHrefRequired']);
    deepStrictEqual((await save<ApiErrorResponse>(randomUUID(), form)).body.key, 'admin.errors.notFound');
    deepStrictEqual((await save<ApiErrorResponse>('x', form)).body.key, 'admin.errors.invalidId');
  });
});
