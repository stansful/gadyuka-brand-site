import { deepStrictEqual, strictEqual } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import type { ApiErrorResponse, ApiValidationErrorResponse } from '~shared/contracts/errors';
import type { LeadStatusResponse } from '~shared/contracts/leads';

import { TestAdmin } from '~test/e2e/test-admin';
import { TestApp } from '~test/e2e/test-app';
import { LeadFixtures } from '~usecases/admin/leads/common/test/lead-fixtures';

import { LEAD_STATUS_ROUTE } from './lead-status.route';

describe('[e2e] PATCH /api/v1/admin/leads/:id/status', () => {
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

  function setStatus<T = LeadStatusResponse>(id: string, body: unknown) {
    return app.api.patch<T>(LEAD_STATUS_ROUTE.replace(':id', id), { body, accessToken });
  }

  it('stores the status and answers it', async () => {
    const id = await fixtures.create();
    const response = await setStatus(id, { status: 'IN_PROGRESS' });
    strictEqual(response.status, 200);
    deepStrictEqual(response.body, { id, status: 'IN_PROGRESS' });
    const stored = await app.database.client.lead.findUniqueOrThrow({ where: { id }, select: { status: true } });
    strictEqual(stored.status, 'IN_PROGRESS');
    strictEqual((await setStatus(id, { status: 'NEW' })).status, 200);
  });

  it('answers 404 admin.errors.notFound for an unknown lead', async () => {
    const response = await setStatus<ApiErrorResponse>(randomUUID(), { status: 'IN_PROGRESS' });
    strictEqual(response.status, 404);
    deepStrictEqual(response.body, { statusCode: 404, error: 'notFound', key: 'admin.errors.notFound' });
  });

  it('refuses an unknown status, extra fields and a malformed id', async () => {
    const response = await setStatus<ApiValidationErrorResponse>(randomUUID(), { status: 'ARCHIVED', note: 'x' });
    strictEqual(response.status, 400);
    deepStrictEqual(response.body.fields, {
      status: { key: 'admin.validation.invalid' },
      note: { key: 'admin.validation.unknownField' },
    });
    const malformed = await setStatus<ApiValidationErrorResponse>('not-a-uuid', { status: 'DONE' });
    deepStrictEqual([malformed.status, malformed.body.fields], [400, { id: { key: 'admin.validation.idInvalid' } }]);
  });

  it('needs a signed-in admin', async () => {
    const response = await app.api.patch(LEAD_STATUS_ROUTE.replace(':id', randomUUID()), { body: { status: 'NEW' } });
    strictEqual(response.status, 401);
  });
});
