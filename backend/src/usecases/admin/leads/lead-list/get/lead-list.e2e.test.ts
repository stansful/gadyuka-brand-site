import { deepStrictEqual, ok, strictEqual } from 'node:assert';
import { after, before, describe, it } from 'node:test';

import type { ApiErrorResponse, ApiValidationErrorResponse } from '~shared/contracts/errors';
import type { LeadListItem, LeadListResponse } from '~shared/contracts/leads';

import { LeadStatus } from '~core/leads/lead-status';
import { LeadType } from '~core/leads/lead-type';
import { TestAdmin } from '~test/e2e/test-admin';
import { TestApp } from '~test/e2e/test-app';
import { LeadFixtures } from '~usecases/admin/leads/common/test/lead-fixtures';

import { LEAD_LIST_ROUTE } from './lead-list.route';

describe('[e2e] GET /api/v1/admin/leads', () => {
  /** Older than any other lead of the tests: the last rows of their filtered lists. */
  const EPOCH = Date.parse('1990-01-01T00:00:00.000Z');
  const MINUTE = 60_000;
  let app: TestApp;
  let admin: TestAdmin;
  let accessToken: string;
  let fixtures: LeadFixtures;
  /** PARTNERSHIP + SPAM leads, oldest first */
  const spamIds: string[] = [];
  let doneId: string;

  before(async () => {
    app = await TestApp.start();
    admin = await TestAdmin.create(app.database);
    accessToken = await admin.signIn(app.api);
    fixtures = new LeadFixtures(app.database);
    for (let index = 0; index < 27; index += 1) {
      const createdAt = new Date(EPOCH + index * MINUTE);
      spamIds.push(await fixtures.create({ type: LeadType.PARTNERSHIP, status: LeadStatus.SPAM, createdAt }));
    }
    doneId = await fixtures.create({
      type: LeadType.TAILORING,
      status: LeadStatus.DONE,
      name: 'Анна',
      email: 'anna@mail.ru',
      phone: '+79001234567',
      message: `  Хочу\n\n худи ${'я'.repeat(200)}`,
      locale: 'en',
      telegramSent: true,
      createdAt: new Date(EPOCH - MINUTE),
    });
  });

  after(async () => {
    await fixtures.remove();
    await admin.remove();
    await app.stop();
  });

  function list<T = LeadListResponse>(query: string) {
    return app.api.get<T>(`${LEAD_LIST_ROUTE}${query}`, { accessToken });
  }

  function assertNewestFirst(items: readonly LeadListItem[]): void {
    const times = items.map(item => Date.parse(item.createdAt));
    ok(
      times.every((time, index) => index === 0 || time <= times[index - 1]),
      'newest first',
    );
  }

  it('pages the filtered list 25 at a time, newest first', async () => {
    const first = await list('?type=PARTNERSHIP&status=SPAM');
    strictEqual(first.status, 200);
    const { total, pageSize, pageCount, page, items } = first.body;
    ok(total >= 27);
    deepStrictEqual([page, pageSize, pageCount, items.length], [1, 25, Math.ceil(total / 25), 25]);
    ok(items.every(item => item.type === 'PARTNERSHIP' && item.status === 'SPAM'));
    assertNewestFirst(items);
  });

  it('clamps a page past the end to the last page, whose last rows are the oldest', async () => {
    const last = await list('?type=PARTNERSHIP&status=SPAM&page=999999');
    strictEqual(last.status, 200);
    strictEqual(last.body.page, last.body.pageCount);
    deepStrictEqual(
      last.body.items.slice(-2).map(item => item.id),
      [spamIds[1], spamIds[0]],
    );
    assertNewestFirst(last.body.items);
  });

  it('answers the list items with a one-line preview of the message', async () => {
    const done = await list('?type=TAILORING&status=DONE&page=999999');
    deepStrictEqual(done.body.items.at(-1), {
      id: doneId,
      type: 'TAILORING',
      status: 'DONE',
      name: 'Анна',
      email: 'anna@mail.ru',
      phone: '+79001234567',
      preview: `Хочу худи ${'я'.repeat(130)}…`,
      locale: 'en',
      telegramSent: true,
      createdAt: new Date(EPOCH - MINUTE).toISOString(),
    });
  });

  it('lists every lead without filters (one page at least)', async () => {
    const all = await list('');
    strictEqual(all.status, 200);
    ok(all.body.total >= 28);
    deepStrictEqual([all.body.page, all.body.pageCount], [1, Math.max(1, Math.ceil(all.body.total / 25))]);
    assertNewestFirst(all.body.items);
  });

  it('refuses unknown filters and pages', async () => {
    const response = await list<ApiValidationErrorResponse>('?type=OTHER&status=ARCHIVED&page=0');
    strictEqual(response.status, 400);
    deepStrictEqual(response.body.fields, {
      type: { key: 'admin.validation.invalid' },
      status: { key: 'admin.validation.invalid' },
      page: { key: 'admin.validation.invalid' },
    });
    strictEqual((await list<ApiValidationErrorResponse>('?page=abc')).status, 400);
  });

  it('needs a signed-in admin', async () => {
    strictEqual((await app.api.get<ApiErrorResponse>(LEAD_LIST_ROUTE)).status, 401);
  });
});
