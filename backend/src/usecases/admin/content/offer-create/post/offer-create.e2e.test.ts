import { deepStrictEqual, ok, strictEqual } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import type { ContentEntitySaved } from '~shared/contracts/content-entities';
import type { ApiErrorResponse, ApiValidationErrorResponse } from '~shared/contracts/errors';

import { TestAdmin } from '~test/e2e/test-admin';
import { TestApp } from '~test/e2e/test-app';
import { ContentTestRows } from '~usecases/admin/content/common/test/content-test-rows';

import { OFFER_CREATE_ROUTE } from './offer-create.route';

describe('[e2e] POST /api/v1/admin/offers', () => {
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
    title: { ru: 'Скидка' },
    text: {},
    badge: {},
    ctaLabel: {},
    ctaHref: null,
    validUntil: null,
    imageId: null,
    published: false,
  };

  async function create<T = ContentEntitySaved>(body: unknown) {
    const response = await app.api.post<T>(OFFER_CREATE_ROUTE, { body, accessToken });
    if (response.status === 201) {
      rows.track('offer', (response.body as ContentEntitySaved).id);
    }
    return response;
  }

  it('adds the offer at the end: texts normalized, the link trimmed, valid through the last day', async () => {
    const last = await app.database.client.offer.create({
      data: { title: { ru: 'Последнее' }, order: 5000 },
      select: { id: true },
    });
    rows.track('offer', last.id);
    const response = await create({
      ...form,
      badge: { ru: ' −15% ', en: '' },
      ctaLabel: { ru: 'Купить' },
      ctaHref: ' #contacts ',
      validUntil: '2026-10-31',
      published: true,
    });
    strictEqual(response.status, 201);
    const stored = await app.database.client.offer.findUniqueOrThrow({ where: { id: response.body.id } });
    deepStrictEqual(
      [stored.badge, stored.ctaLabel, stored.ctaHref, stored.validUntil?.toISOString(), stored.published],
      [{ ru: '−15%' }, { ru: 'Купить' }, '#contacts', '2026-10-31T20:59:59.999Z', true],
    );
    ok(stored.order > 5000, `order ${stored.order} after the last offer`);
  });

  it('answers 400 ctaHrefRequired for a button label without a link', async () => {
    const response = await create<ApiErrorResponse>({ ...form, ctaLabel: { en: 'Buy' } });
    deepStrictEqual(
      [response.status, response.body],
      [400, { statusCode: 400, error: 'badRequest', key: 'admin.offers.ctaHrefRequired' }],
    );
  });

  it('checks the picture before the button', async () => {
    const response = await create<ApiErrorResponse>({ ...form, ctaLabel: { ru: 'Купить' }, imageId: randomUUID() });
    deepStrictEqual([response.status, response.body.key], [400, 'admin.errors.missingMedia']);
  });

  it('refuses javascript: links and impossible days with field keys', async () => {
    const response = await create<ApiValidationErrorResponse>({
      ...form,
      ctaHref: 'javascript:alert(1)',
      validUntil: '2026-02-30',
    });
    deepStrictEqual(response.body.fields, {
      ctaHref: { key: 'admin.validation.siteHref' },
      validUntil: { key: 'admin.validation.dateRequired' },
    });
  });
});
