import { deepStrictEqual, strictEqual } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import type { ApiErrorResponse, ApiValidationErrorResponse } from '~shared/contracts/errors';
import type { LeadResendResponse } from '~shared/contracts/leads';

import { Locale } from '~core/locales/locale.enum';
import { MessageCatalog, MessagesDirectory } from '~module/messages';
import { TestAdmin } from '~test/e2e/test-admin';
import { TestApp } from '~test/e2e/test-app';
import { LeadFixtures } from '~usecases/admin/leads/common/test/lead-fixtures';

import { LEAD_RESEND_ROUTE } from './lead-resend.route';

describe('[e2e] POST /api/v1/admin/leads/:id/resend', () => {
  const dryRunNotice = new MessageCatalog(MessagesDirectory.locate()).siteDefault('telegram.errors.dryRun', Locale.RU);
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

  function resend<T = LeadResendResponse>(id: string) {
    return app.api.post<T>(LEAD_RESEND_ROUTE.replace(':id', id), { accessToken });
  }

  it('sends the lead again and stores the outcome (a dry run is «not sent», with the notice)', async () => {
    const id = await fixtures.create({ telegramSent: true, email: 'ivan@mail.ru' });
    const response = await resend(id);
    strictEqual(response.status, 200);
    deepStrictEqual(response.body, { id, telegramSent: false, telegramError: dryRunNotice });
    const stored = await app.database.client.lead.findUniqueOrThrow({
      where: { id },
      select: { telegramSent: true, telegramError: true },
    });
    deepStrictEqual(stored, { telegramSent: false, telegramError: dryRunNotice });
  });

  it('answers 404 admin.leads.notFound for an unknown lead and 400 for a malformed id', async () => {
    const missing = await resend<ApiErrorResponse>(randomUUID());
    strictEqual(missing.status, 404);
    deepStrictEqual(missing.body, { statusCode: 404, error: 'notFound', key: 'admin.leads.notFound' });
    const malformed = await resend<ApiValidationErrorResponse>('42');
    deepStrictEqual([malformed.status, malformed.body.fields], [400, { id: { key: 'admin.validation.idInvalid' } }]);
  });

  it('needs a signed-in admin', async () => {
    strictEqual((await app.api.post(LEAD_RESEND_ROUTE.replace(':id', randomUUID()))).status, 401);
  });
});
