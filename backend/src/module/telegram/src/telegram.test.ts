import { deepStrictEqual, ok, strictEqual } from 'node:assert';
import { describe, it, mock } from 'node:test';

import { LeadType } from '~core/leads/lead-type';
import { Locale } from '~core/locales/locale.enum';
import { ISleeper } from '~module/common';
import { Clock } from '~module/common';
import { MessageCatalog, MessageFormatter, MessagesDirectory } from '~module/messages';
import { SiteMessagesService } from '~module/site-messages';
import { InMemorySiteMessageRows } from '~module/site-messages/src/test/in-memory-site-message-rows';
import {
  ContactMasker,
  HtmlEscaper,
  LeadMessageFormatter,
  TELEGRAM_DEFAULTS,
  TelegramDeliveryStatus,
  TelegramFetch,
  TelegramLead,
  TelegramLeadNotifier,
  TelegramMessageKey,
  TelegramOptions,
  TelegramTexts,
  TelegramTransport,
} from '~module/telegram';

const catalog = new MessageCatalog(MessagesDirectory.locate());
/** The admin's Message rows (none: the shared/messages defaults), as SiteMessagesService reads them. */
const messageRows = new InMemorySiteMessageRows();
const siteMessages = new SiteMessagesService(messageRows, new Clock(), catalog);
const texts = new TelegramTexts(siteMessages, catalog, new MessageFormatter());
const formatter = new LeadMessageFormatter(texts);
/** The owner-facing copy: telegram.* of shared/messages/ru.json. */
const copy = (key: string): string => catalog.siteDefault(`telegram.${key}`, Locale.RU);

const TOKEN = '123456789:AAFakeTokenForTests_abcdefghijklmnop';
const LIVE: TelegramOptions = { token: TOKEN, chatId: '424242', dryRun: false, siteUrl: '', isProduction: false };

const lead: TelegramLead = {
  id: '0199f2c4-1111-7000-8000-000000000001',
  type: LeadType.TAILORING,
  name: 'Иван <b>Петров</b>',
  email: 'ivan@mail.ru',
  phone: '+79001234567',
  message: 'Хочу худи & штаны <script>alert(1)</script>',
  locale: 'ru',
  createdAt: new Date('2026-10-16T09:30:00.000Z'),
};

function apiError(status: number, details: string): string {
  return copy('errors.api').replace('{status}', String(status)).replace('{details}', details);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

class RecordingSleeper implements ISleeper {
  readonly waits: number[] = [];

  async sleep(milliseconds: number): Promise<void> {
    this.waits.push(milliseconds);
  }
}

function transportWith(fetch: TelegramFetch, options: Partial<TelegramOptions> = {}, sleeper = new RecordingSleeper()) {
  return new TelegramTransport({ ...LIVE, ...options }, fetch, sleeper, texts);
}

describe('HtmlEscaper', () => {
  it('escapes the characters Telegram HTML cares about, once', () => {
    const escaper = new HtmlEscaper();
    strictEqual(escaper.escape(`<a href="x">Tom & Jerry</a>`), '&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&lt;/a&gt;');
    strictEqual(escaper.escape('&amp;'), '&amp;amp;');
  });
});

describe('ContactMasker', () => {
  it('masks phones, emails and names', () => {
    const masker = new ContactMasker();
    strictEqual(masker.maskPhone('+79001234567'), '+7******4567');
    strictEqual(masker.maskEmail('ivan@mail.ru'), 'i***@mail.ru');
    strictEqual(masker.maskEmail('broken'), '***');
    strictEqual(masker.maskName(' Иван Петров'), 'И***');
  });
});

describe('LeadMessageFormatter', () => {
  it('builds the owner message from the telegram.* messages, with the type emoji and escaped input', () => {
    const text = formatter.formatForOwner(lead, '');
    ok(text.startsWith(`🧵 <b>${copy('newLead').replace('{type}', copy('leadTypes.TAILORING'))}</b>`));
    ok(text.includes(`👤 <b>${copy('name')}</b> Иван &lt;b&gt;Петров&lt;/b&gt;`));
    ok(text.includes(`📞 <b>${copy('phone')}</b> +79001234567`));
    ok(text.includes(`✉️ <b>${copy('email')}</b> ivan@mail.ru`));
    ok(text.includes('<blockquote>Хочу худи &amp; штаны &lt;script&gt;alert(1)&lt;/script&gt;</blockquote>'));
    ok(text.includes(`🕒 ${copy('time').replace('{time}', '16.10.2026, 12:30')}`), 'Moscow time');
    ok(text.includes(`🆔 <code>${lead.id}</code>`));
    ok(!text.includes('<script>'));
  });

  it('uses a different emoji per type and omits empty fields', () => {
    const partnership = formatter.formatForOwner({ ...lead, type: LeadType.PARTNERSHIP, phone: null, message: '' }, '');
    ok(partnership.startsWith('🤝 '));
    ok(!partnership.includes(copy('phone')));
    ok(!partnership.includes(copy('message')));
    ok(formatter.formatForOwner({ ...lead, type: LeadType.CONTACT }, '').startsWith('💬'));
  });

  it('adds the admin link only for https sites', () => {
    ok(
      formatter
        .formatForOwner(lead, 'https://gadyuka.ru/')
        .includes(`<a href="https://gadyuka.ru/admin/leads">${copy('openAdmin')}</a>`),
    );
    ok(!formatter.formatForOwner(lead, 'http://localhost:3000').includes('<a href'));
  });

  it('stays within the 4096-character Telegram limit', () => {
    const text = formatter.formatForOwner({ ...lead, message: '<&>'.repeat(2000) }, '');
    ok(text.length <= TELEGRAM_DEFAULTS.maxMessageLength);
    ok(text.includes('…</blockquote>'));
  });

  it('previews without personal data (masked contacts and name, no message text)', () => {
    const text = formatter.formatPreview({ ...lead, message: 'x'.repeat(500) });
    ok(text.includes('+7******4567'));
    ok(text.includes('i***@mail.ru'));
    ok(text.includes('И***'));
    ok(text.includes('[500 chars]'));
    for (const secret of ['+79001234567', 'ivan@mail.ru', 'Петров', 'xxxxx']) {
      ok(!text.includes(secret), secret);
    }
  });
});

describe('TelegramTransport', () => {
  it('dry run: no network', async () => {
    const fetch = mock.fn<TelegramFetch>();
    deepStrictEqual(await transportWith(fetch, { dryRun: true }).send('hi'), {
      status: TelegramDeliveryStatus.DRY_RUN,
    });
    strictEqual(fetch.mock.callCount(), 0);
  });

  it('posts sendMessage with parse_mode HTML', async () => {
    const fetch = mock.fn<TelegramFetch>(async () => jsonResponse({ ok: true, result: {} }));
    deepStrictEqual(await transportWith(fetch).send('<b>hi</b>'), { status: TelegramDeliveryStatus.SENT });
    const [url, init] = fetch.mock.calls[0]?.arguments ?? [];
    strictEqual(String(url), `https://api.telegram.org/bot${TOKEN}/sendMessage`);
    deepStrictEqual(JSON.parse(String(init?.body)), {
      chat_id: '424242',
      text: '<b>hi</b>',
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
    });
  });

  it('retries network errors and 5xx twice with backoff, then succeeds', async () => {
    const answers: Array<() => Promise<Response>> = [
      () => Promise.reject(new TypeError('fetch failed')),
      () => Promise.resolve(jsonResponse({ ok: false, error_code: 502, description: 'Bad Gateway' }, 502)),
    ];
    const fetch = mock.fn<TelegramFetch>(
      () => answers.shift()?.() ?? Promise.resolve(jsonResponse({ ok: true, result: {} })),
    );
    const sleeper = new RecordingSleeper();
    deepStrictEqual(await transportWith(fetch, {}, sleeper).send('hi'), { status: TelegramDeliveryStatus.SENT });
    strictEqual(fetch.mock.callCount(), 3);
    deepStrictEqual(sleeper.waits, [...TELEGRAM_DEFAULTS.backoffMs]);
  });

  it('gives up after 1 + 2 attempts and returns the last error', async () => {
    const fetch = mock.fn<TelegramFetch>(async () => jsonResponse({ ok: false, description: 'Internal' }, 500));
    deepStrictEqual(await transportWith(fetch).send('hi'), {
      status: TelegramDeliveryStatus.FAILED,
      error: apiError(500, 'Internal'),
    });
    strictEqual(fetch.mock.callCount(), 3);
  });

  it('does not retry client errors (chat not found)', async () => {
    const fetch = mock.fn<TelegramFetch>(async () =>
      jsonResponse({ ok: false, error_code: 400, description: 'Bad Request: chat not found' }, 400),
    );
    const result = await transportWith(fetch).send('hi');
    deepStrictEqual(result, {
      status: TelegramDeliveryStatus.FAILED,
      error: apiError(400, 'Bad Request: chat not found'),
    });
    strictEqual(fetch.mock.callCount(), 1);
  });

  it('words a refusal without a description with the status text, or «unknown»', async () => {
    const html = mock.fn<TelegramFetch>(async () => new Response('<html>', { status: 502, statusText: 'Bad Gateway' }));
    deepStrictEqual(await transportWith(html, { retries: 0 }).send('hi'), {
      status: TelegramDeliveryStatus.FAILED,
      error: apiError(502, 'Bad Gateway'),
    });
    const bare = mock.fn<TelegramFetch>(async () => new Response(null, { status: 503 }));
    deepStrictEqual(await transportWith(bare, { retries: 0 }).send('hi'), {
      status: TelegramDeliveryStatus.FAILED,
      error: apiError(503, copy('errors.unknown')),
    });
  });

  it('honours retry_after on 429', async () => {
    const answers = [
      jsonResponse({ ok: false, error_code: 429, parameters: { retry_after: 3 } }, 429),
      jsonResponse({ ok: true, result: {} }),
    ];
    const fetch = mock.fn<TelegramFetch>(async () => answers.shift() ?? jsonResponse({ ok: true }));
    const sleeper = new RecordingSleeper();
    deepStrictEqual(await transportWith(fetch, {}, sleeper).send('hi'), { status: TelegramDeliveryStatus.SENT });
    deepStrictEqual(sleeper.waits, [3000]);
  });

  it('never leaks the bot token in errors', async () => {
    const fetch = mock.fn<TelegramFetch>(async () => {
      throw new Error(`connect failed for https://api.telegram.org/bot${TOKEN}/sendMessage`);
    });
    const result = await transportWith(fetch).send('hi');
    ok(result.status === TelegramDeliveryStatus.FAILED);
    ok(!result.error.includes(TOKEN));
    ok(result.error.includes('***'));
  });

  it('reports a missing or malformed configuration without calling the API', async () => {
    const fetch = mock.fn<TelegramFetch>();
    deepStrictEqual(await transportWith(fetch, { token: '', chatId: '' }).send('hi'), {
      status: TelegramDeliveryStatus.FAILED,
      error: copy('errors.notConfigured'),
    });
    deepStrictEqual(await transportWith(fetch, { token: 'not-a-token' }).send('hi'), {
      status: TelegramDeliveryStatus.FAILED,
      error: copy('errors.badToken'),
    });
    strictEqual(fetch.mock.callCount(), 0);
  });

  it('reports a timeout with its message', async () => {
    const fetch = mock.fn<TelegramFetch>(async () => {
      throw new DOMException('The operation timed out.', 'TimeoutError');
    });
    deepStrictEqual(await transportWith(fetch, { retries: 0 }).send('hi'), {
      status: TelegramDeliveryStatus.FAILED,
      error: copy('errors.timeout'),
    });
  });
});

describe('TelegramLeadNotifier', () => {
  it('a dry run is not a delivery: Lead.telegramError gets the dry-run notice', async () => {
    const options = { ...LIVE, dryRun: true };
    const notifier = new TelegramLeadNotifier(
      options,
      transportWith(mock.fn<TelegramFetch>(), options),
      formatter,
      texts,
    );
    const result = await notifier.notify(lead);
    deepStrictEqual(result, { status: TelegramDeliveryStatus.DRY_RUN });
    strictEqual(notifier.errorOf(result), copy('errors.dryRun'));
  });

  it('records a delivery as no error and a failure as its error', async () => {
    const sent = mock.fn<TelegramFetch>(async () => jsonResponse({ ok: true, result: {} }));
    const notifier = new TelegramLeadNotifier(LIVE, transportWith(sent), formatter, texts);
    strictEqual(notifier.errorOf(await notifier.notify(lead)), null);
    const blocked = mock.fn<TelegramFetch>(async () =>
      jsonResponse({ ok: false, description: 'Forbidden: bot was blocked by the user' }, 403),
    );
    const failing = new TelegramLeadNotifier(LIVE, transportWith(blocked), formatter, texts);
    strictEqual(
      failing.errorOf(await failing.notify(lead)),
      'Telegram отклонил сообщение (код 403): Forbidden: bot was blocked by the user',
    );
  });

  it('formats the flood-ceiling status for Lead.telegramError', () => {
    strictEqual(
      texts.text(TelegramMessageKey.ERROR_NOTIFY_CEILING, { max: 60, minutes: 10 }),
      copy('errors.notifyCeiling').replace('{max}', '60').replace('{minutes}', '10'),
    );
  });

  it('uses the telegram.* texts the admin edited (Message rows), loaded before formatting', async () => {
    const rows = new InMemorySiteMessageRows();
    const editedMessages = new SiteMessagesService(rows, new Clock(), catalog);
    const editedTexts = new TelegramTexts(editedMessages, catalog, new MessageFormatter());
    rows.replaceRows([{ key: 'telegram.newLead', locale: 'ru', value: 'Свежая заявка — {type}' }]);
    const sent = mock.fn<TelegramFetch>(async () => jsonResponse({ ok: true, result: {} }));
    const transport = new TelegramTransport(LIVE, sent, new RecordingSleeper(), editedTexts);
    const notifier = new TelegramLeadNotifier(LIVE, transport, new LeadMessageFormatter(editedTexts), editedTexts);
    await notifier.notify(lead);
    const body = JSON.parse(String(sent.mock.calls[0]?.arguments[1]?.body)) as { text: string };
    ok(body.text.includes(`Свежая заявка — ${copy('leadTypes.TAILORING')}`), body.text);
  });

  it('keeps the default texts when the Message rows cannot be read', async () => {
    const rows = new InMemorySiteMessageRows();
    rows.failWith(new Error('database down'));
    const failingTexts = new TelegramTexts(
      new SiteMessagesService(rows, new Clock(), catalog),
      catalog,
      new MessageFormatter(),
    );
    await failingTexts.load();
    strictEqual(failingTexts.text(TelegramMessageKey.OPEN_ADMIN), copy('openAdmin'));
  });

  it('every telegram message key exists in shared/messages', () => {
    for (const key of Object.values(TelegramMessageKey)) {
      ok(catalog.isSiteKey(`telegram.${key}`), key);
    }
  });
});
