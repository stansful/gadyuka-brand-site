import { deepStrictEqual, strictEqual } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import type { ApiErrorResponse, ApiValidationErrorResponse } from '~shared/contracts/errors';
import type { LeadDetailResponse } from '~shared/contracts/leads';

import { LeadStatus } from '~core/leads/lead-status';
import { LeadType } from '~core/leads/lead-type';
import { TestAdmin } from '~test/e2e/test-admin';
import { TestApp } from '~test/e2e/test-app';
import { LeadFixtures } from '~usecases/admin/leads/common/test/lead-fixtures';

import { LEAD_DETAIL_ROUTE } from './lead-detail.route';

describe('[e2e] GET /api/v1/admin/leads/:id', () => {
  let app: TestApp;
  let admin: TestAdmin;
  let accessToken: string;
  let fixtures: LeadFixtures;

  before(async () => {
    app = await TestApp.start();
    admin = await TestAdmin.create(app.database);
    accessToken = await admin.signIn(app.api);
    fixtures = new LeadFixtures(app.database);
  });

  after(async () => {
    await fixtures.remove();
    await admin.remove();
    await app.stop();
  });

  function detail<T = LeadDetailResponse>(id: string) {
    return app.api.get<T>(LEAD_DETAIL_ROUTE.replace(':id', id), { accessToken });
  }

  it('answers the lead with its whole message, metadata and Telegram status', async () => {
    const createdAt = new Date('2021-05-01T10:00:00.000Z');
    const id = await fixtures.create({
      type: LeadType.PARTNERSHIP,
      status: LeadStatus.IN_PROGRESS,
      name: 'Магазин',
      email: 'shop@partner.ru',
      message: 'Предлагаем\nколлаборацию',
      telegramError: 'Telegram отклонил сообщение (код 403): Forbidden',
      meta: { consentAt: '2021-05-01T10:00:00.000Z', userAgent: 'Mozilla/5.0', referer: null, source: 'site' },
      createdAt,
    });
    const response = await detail(id);
    strictEqual(response.status, 200);
    const { updatedAt } = await app.database.client.lead.findUniqueOrThrow({
      where: { id },
      select: { updatedAt: true },
    });
    // Lead.meta is jsonb: Postgres keeps its own key order (the admin shows the entries as stored).
    const meta = [...response.body.meta].sort((a, b) => a.key.localeCompare(b.key));
    deepStrictEqual(
      { ...response.body, meta },
      {
        id,
        type: 'PARTNERSHIP',
        status: 'IN_PROGRESS',
        name: 'Магазин',
        email: 'shop@partner.ru',
        phone: null,
        preview: 'Предлагаем коллаборацию',
        locale: 'ru',
        telegramSent: false,
        createdAt: createdAt.toISOString(),
        message: 'Предлагаем\nколлаборацию',
        telegramError: 'Telegram отклонил сообщение (код 403): Forbidden',
        meta: [
          { key: 'consentAt', value: '2021-05-01T10:00:00.000Z' },
          { key: 'referer', value: 'null' },
          { key: 'source', value: 'site' },
          { key: 'userAgent', value: 'Mozilla/5.0' },
        ],
        updatedAt: updatedAt.toISOString(),
      },
    );
  });

  it('answers a lead without metadata with an empty list', async () => {
    const response = await detail(await fixtures.create());
    deepStrictEqual([response.body.meta, response.body.message, response.body.telegramError], [[], '', null]);
  });

  it('answers 404 admin.leads.notFound for an unknown lead and 400 for a malformed id', async () => {
    const missing = await detail<ApiErrorResponse>(randomUUID());
    strictEqual(missing.status, 404);
    deepStrictEqual(missing.body, { statusCode: 404, error: 'notFound', key: 'admin.leads.notFound' });
    const malformed = await detail<ApiValidationErrorResponse>('not-a-uuid');
    strictEqual(malformed.status, 400);
    deepStrictEqual(malformed.body.fields, { id: { key: 'admin.validation.idInvalid' } });
  });

  it('needs a signed-in admin', async () => {
    strictEqual((await app.api.get(LEAD_DETAIL_ROUTE.replace(':id', randomUUID()))).status, 401);
  });
});
