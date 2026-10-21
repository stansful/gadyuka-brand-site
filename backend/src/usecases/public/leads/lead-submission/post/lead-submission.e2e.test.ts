import { deepStrictEqual, notStrictEqual, ok, strictEqual } from 'node:assert';
import { randomBytes } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';

import type { ApiErrorResponse, ApiValidationErrorResponse } from '~shared/contracts/errors';
import type { LeadSubmitResponse } from '~shared/contracts/leads';

import { RequestHeader } from '~core/constants/request-header.enum';
import { LeadRateWindow } from '~core/leads/lead-rate-window';
import { LeadType } from '~core/leads/lead-type';
import { Locale } from '~core/locales/locale.enum';
import { LeadNotificationScheduler } from '~module/lead-notification';
import { MessageCatalog, MessagesDirectory } from '~module/messages';
import { SiteMessagesService } from '~module/site-messages';
import { TestClientIp } from '~test/e2e/client-ip';
import { TestApp } from '~test/e2e/test-app';

import { LEAD_SUBMISSION_ROUTE } from './lead-submission.route';

/**
 * More parallel leads than DatabaseService has pool connections (10): each holds one for its transaction,
 * so any read through the main client from inside it would never get a connection.
 */
const BURST_WIDER_THAN_POOL = 12;

describe('[e2e] POST /api/v1/public/leads', () => {
  const catalog = new MessageCatalog(MessagesDirectory.locate());
  const telegramText = (key: string): string => catalog.siteDefault(`telegram.${key}`, Locale.RU);
  const valid = {
    type: 'CONTACT',
    name: 'Иван',
    email: 'ivan@mail.ru',
    message: 'Привет',
    locale: 'ru',
    consent: true,
    hp: '',
  };
  /** Ids of the leads this file stored (removed at the end). */
  const storedIds = new Set<string>();
  let app: TestApp;

  before(async () => {
    app = await TestApp.start();
  });

  after(async () => {
    await app.get(LeadNotificationScheduler).onModuleDestroy();
    await app.database.client.lead.deleteMany({ where: { id: { in: [...storedIds] } } });
    await app.stop();
  });

  async function submit<T = LeadSubmitResponse>(
    body: unknown,
    clientIp = TestClientIp.random(),
    userAgent = 'e2e-agent',
  ) {
    const response = await app.api.post<T>(LEAD_SUBMISSION_ROUTE, {
      body,
      headers: { [RequestHeader.CLIENT_IP]: clientIp, [RequestHeader.CLIENT_USER_AGENT]: userAgent },
    });
    const answer = response.body;
    if (typeof answer === 'object' && answer !== null && 'id' in answer && typeof answer.id === 'string') {
      storedIds.add(answer.id);
    }
    return response;
  }

  /** `count` recent leads of one made-up network (removed by its ipHash 'flood'). */
  function floodOf(count: number) {
    return Array.from({ length: count }, () => ({
      type: LeadType.CONTACT,
      name: 'Flood',
      message: '',
      locale: 'ru',
      ipHash: 'flood',
    }));
  }

  function findLead(id: string) {
    return app.database.client.lead.findUnique({ where: { id } });
  }

  /** The Telegram notification runs after the answer: wait until its outcome is stored. */
  async function waitForDelivery(id: string): Promise<string | null> {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const lead = await findLead(id);
      if (lead?.telegramError !== null && lead?.telegramError !== undefined) {
        return lead.telegramError;
      }
      await delay(100);
    }
    return null;
  }

  it('stores the normalized lead with its metadata, then notifies the owner (dry run: «not sent»)', async () => {
    const response = await submit(
      {
        type: 'TAILORING',
        name: '  Иван Петров ',
        phone: '8 (900) 123-45-67',
        email: '   ',
        message: '  Хочу худи  ',
        locale: 'de',
        consent: true,
        hp: '',
        referer: `https://gadyuka.ru/${'x'.repeat(600)}`,
      },
      '203.0.113.7',
      'u'.repeat(400),
    );
    strictEqual(response.status, 201);
    const lead = await findLead(response.body.id);
    deepStrictEqual(
      [lead?.type, lead?.name, lead?.email, lead?.phone, lead?.message, lead?.locale, lead?.status],
      ['TAILORING', 'Иван Петров', null, '+79001234567', 'Хочу худи', 'ru', 'NEW'],
    );
    ok(/^[0-9a-f]{64}$/.test(lead?.ipHash ?? ''), 'the network hash, never the IP');
    const meta = lead?.meta;
    ok(typeof meta === 'object' && meta !== null && !Array.isArray(meta));
    deepStrictEqual([meta.userAgent, String(meta.referer).length, meta.source], ['u'.repeat(300), 500, 'site']);
    ok(Math.abs(Date.parse(String(meta.consentAt)) - Date.now()) < 60_000);
    strictEqual(await waitForDelivery(response.body.id), telegramText('errors.dryRun'));
    strictEqual((await findLead(response.body.id))?.telegramSent, false);
  });

  it("stores no User-Agent when the site's server forwarded none (the transport's own is not the visitor's)", async () => {
    const response = await app.api.post<LeadSubmitResponse>(LEAD_SUBMISSION_ROUTE, {
      body: valid,
      headers: { [RequestHeader.CLIENT_IP]: TestClientIp.random(), 'user-agent': 'node' },
    });
    strictEqual(response.status, 201);
    storedIds.add(response.body.id);
    const meta = (await findLead(response.body.id))?.meta;
    ok(typeof meta === 'object' && meta !== null && !Array.isArray(meta));
    strictEqual(meta.userAgent, null);
  });

  it('answers field errors with forms.errors.* keys and stores nothing', async () => {
    const response = await submit<ApiValidationErrorResponse>({ ...valid, email: 'bad', consent: false });
    strictEqual(response.status, 400);
    deepStrictEqual(response.body.fields, {
      email: { key: 'forms.errors.invalidEmail' },
      consent: { key: 'forms.errors.consentRequired' },
    });
    const tailoring = await submit<ApiValidationErrorResponse>({ ...valid, type: 'TAILORING', email: '', name: 'I' });
    deepStrictEqual(tailoring.body.fields, {
      name: { key: 'forms.errors.tooShort', values: { min: 2 } },
      contact: { key: 'forms.errors.contactRequired' },
    });
  });

  it('reports only the type when it is unknown', async () => {
    const response = await submit<ApiValidationErrorResponse>({ type: 'SPAM', name: 1, consent: false });
    strictEqual(response.status, 400);
    deepStrictEqual(response.body.fields, { type: { key: 'forms.errors.invalidType' } });
  });

  it('answers a honeypot hit like a success (a v7 id) without storing anything', async () => {
    const clientIp = TestClientIp.random();
    const response = await submit({ ...valid, name: 1, hp: 'http://spam.example' }, clientIp);
    strictEqual(response.status, 201);
    ok(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(response.body.id));
    strictEqual(await findLead(response.body.id), null);
    strictEqual((await submit(valid, clientIp)).status, 201, 'a honeypot hit does not count for the limit');
  });

  it('refuses the 6th lead of a network in 10 minutes with Retry-After (429), other networks go on', async () => {
    const clientIp = TestClientIp.random();
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 5; attempt += 1) {
      statuses.push((await submit(valid, clientIp)).status);
    }
    deepStrictEqual(statuses, [201, 201, 201, 201, 201]);
    const refused = await submit<ApiErrorResponse>(valid, clientIp);
    strictEqual(refused.status, 429);
    const { statusCode, error, key } = refused.body;
    deepStrictEqual([statusCode, error, key], [429, 'throttled', 'forms.errors.rateLimited']);
    const retryAfter = Number(refused.body.details?.retryAfterSeconds);
    ok(retryAfter > 590 && retryAfter <= 600, String(retryAfter));
    strictEqual((await submit(valid)).status, 201);
  });

  it('counts an IPv6 visitor by the /64: rotating the address inside it does not help', async () => {
    const prefix = `2001:db8:${randomBytes(2).toString('hex')}:${randomBytes(2).toString('hex')}`;
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      strictEqual((await submit(valid, `${prefix}::${attempt}`)).status, 201);
    }
    strictEqual((await submit(valid, `${prefix}:ffff:ffff:ffff:ffff`)).status, 429);
  });

  it('lets exactly 5 of a burst of parallel requests of one network through (advisory lock)', async () => {
    const clientIp = TestClientIp.random();
    const responses = await Promise.all(Array.from({ length: 8 }, () => submit(valid, clientIp)));
    const statuses = responses.map(response => response.status).sort();
    deepStrictEqual(statuses, [201, 201, 201, 201, 201, 429, 429, 429]);
  });

  it('past 60 leads in 10 minutes site-wide: stores the lead «not sent» with the reason, no notification', async () => {
    await app.database.client.lead.createMany({ data: floodOf(60) });
    try {
      const response = await submit(valid);
      strictEqual(response.status, 201);
      const notice = telegramText('errors.notifyCeiling').replace('{max}', '60').replace('{minutes}', '10');
      await delay(500);
      const lead = await findLead(response.body.id);
      deepStrictEqual([lead?.telegramSent, lead?.telegramError], [false, notice]);
      notStrictEqual(notice, telegramText('errors.dryRun'));
    } finally {
      await app.database.client.lead.deleteMany({ where: { ipHash: 'flood' } });
    }
  });

  it('past the ceiling with a cold messages cache, stores every lead of a burst wider than the pool', async () => {
    await app.database.client.lead.createMany({ data: floodOf(LeadRateWindow.SITE_WIDE.max) });
    try {
      app.get(SiteMessagesService).invalidate();
      const burst = Array.from({ length: BURST_WIDER_THAN_POOL }, () => submit(valid));
      const statuses = (await Promise.all(burst)).map(response => response.status);
      deepStrictEqual(
        statuses,
        Array.from({ length: BURST_WIDER_THAN_POOL }, () => 201),
      );
    } finally {
      await app.database.client.lead.deleteMany({ where: { ipHash: 'flood' } });
    }
  });

  it('refuses fields the form does not have', async () => {
    const response = await submit<ApiValidationErrorResponse>({ ...valid, status: 'DONE' });
    strictEqual(response.status, 400);
    deepStrictEqual(response.body.fields, { status: { key: 'admin.validation.unknownField' } });
  });
});
