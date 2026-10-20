import { createTranslator } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { TelegramLead, TelegramText } from './telegram';

import ru from '../../messages/ru.json';

const leadUpdate = vi.fn();
const leadFindUnique = vi.fn();

vi.mock('@/lib/db', () => ({
  db: { lead: { update: leadUpdate, findUnique: leadFindUnique } },
}));

// No Next request scope: the DB-backed messages are the JSON defaults (messages/ru.json).
const getTranslations = vi.fn(async ({ namespace }: { locale: 'ru'; namespace: 'telegram' }) =>
  createTranslator({ locale: 'ru', messages: ru, namespace }),
);
vi.mock('next-intl/server', () => ({ getTranslations }));

const {
  escapeHtml,
  formatLeadMessage,
  loadTelegramText,
  maskEmail,
  maskPhone,
  notifyCeilingError,
  resendLeadToTelegram,
  sendLeadToTelegram,
  sendTelegramMessage,
  TELEGRAM_DEFAULTS,
} = await import('./telegram');

/** The owner-facing copy: messages telegram.* (default locale). */
const copy = ru.telegram;
const t: TelegramText = await loadTelegramText();

/** telegram.errors.api: a refusal of the Bot API, with Telegram's own description as details. */
function apiError(status: number, details: string): string {
  return copy.errors.api.replace('{status}', String(status)).replace('{details}', details);
}

const TOKEN = '123456789:AAFakeTokenForTests_abcdefghijklmnop';
const LIVE = { config: { dryRun: false, token: TOKEN, chatId: '424242', siteUrl: '' } } as const;

const lead: TelegramLead = {
  id: 'clead123',
  type: 'TAILORING',
  name: 'Иван <b>Петров</b>',
  email: 'ivan@mail.ru',
  phone: '+79001234567',
  message: 'Хочу худи & штаны <script>alert(1)</script>',
  locale: 'ru',
  createdAt: new Date('2026-10-16T09:30:00.000Z'),
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const noSleep = vi.fn(async (_ms: number) => {});

beforeEach(() => {
  leadUpdate.mockReset().mockResolvedValue({});
  leadFindUnique.mockReset();
  noSleep.mockClear();
  getTranslations.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('escapeHtml', () => {
  it('escapes the characters Telegram HTML cares about', () => {
    expect(escapeHtml(`<a href="x">Tom & Jerry</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&lt;/a&gt;');
  });

  it('does not double-escape when applied once to raw input', () => {
    expect(escapeHtml('&amp;')).toBe('&amp;amp;');
  });
});

describe('formatLeadMessage', () => {
  it('builds the owner message from the telegram.* messages, with the type emoji and escaped user input', () => {
    const text = formatLeadMessage(lead, t);
    expect(text).toContain(`🧵 <b>${copy.newLead.replace('{type}', copy.leadTypes.TAILORING)}</b>`);
    expect(text).toContain(`👤 <b>${copy.name}</b> Иван &lt;b&gt;Петров&lt;/b&gt;`);
    expect(text).toContain(`📞 <b>${copy.phone}</b> +79001234567`);
    expect(text).toContain(`✉️ <b>${copy.email}</b> ivan@mail.ru`);
    expect(text).toContain(`📝 <b>${copy.message}</b>`);
    expect(text).toContain('<blockquote>Хочу худи &amp; штаны &lt;script&gt;alert(1)&lt;/script&gt;</blockquote>');
    expect(text).toContain(`🕒 ${copy.time.replace('{time}', '16.10.2026, 12:30')}`); // Moscow time
    expect(text).toContain('🆔 <code>clead123</code>');
    expect(text).not.toContain('<script>');
    expect(text).not.toContain('<b>Петров</b>');
  });

  it('uses a different emoji per type and omits empty fields', () => {
    const partnership = formatLeadMessage({ ...lead, type: 'PARTNERSHIP', phone: null, message: '' }, t);
    expect(partnership.startsWith(`🤝 <b>${copy.newLead.replace('{type}', copy.leadTypes.PARTNERSHIP)}</b>`)).toBe(
      true,
    );
    expect(partnership).not.toContain(copy.phone);
    expect(partnership).not.toContain(copy.message);
    expect(formatLeadMessage({ ...lead, type: 'CONTACT' }, t).startsWith('💬')).toBe(true);
  });

  it('escapes the messages too (they are edited in the admin)', () => {
    const edited: TelegramText = (key, values) => (key === 'name' ? 'Имя <i>&</i>' : t(key, values));
    expect(formatLeadMessage(lead, edited)).toContain('👤 <b>Имя &lt;i&gt;&amp;&lt;/i&gt;</b>');
  });

  it('adds the admin link only for https sites', () => {
    expect(formatLeadMessage(lead, t, { siteUrl: 'https://gadyuka.ru/' })).toContain(
      `<a href="https://gadyuka.ru/admin/leads">${copy.openAdmin}</a>`,
    );
    expect(formatLeadMessage(lead, t, { siteUrl: 'http://localhost:3000' })).not.toContain('<a href');
  });

  it('stays within the 4096-character Telegram limit', () => {
    const text = formatLeadMessage({ ...lead, message: '<&>'.repeat(2000) }, t);
    expect(text.length).toBeLessThanOrEqual(TELEGRAM_DEFAULTS.maxMessageLength);
    expect(text).toContain('…</blockquote>');
  });

  it('redacts contacts and shortens the message for logs', () => {
    const text = formatLeadMessage({ ...lead, message: 'x'.repeat(500) }, t, { redact: true });
    expect(text).toContain('+7******4567');
    expect(text).toContain('i***@mail.ru');
    expect(text).not.toContain('+79001234567');
    expect(text).not.toContain('x'.repeat(250));
  });
});

describe('masking', () => {
  it('masks phones and emails', () => {
    expect(maskPhone('+79001234567')).toBe('+7******4567');
    expect(maskEmail('ivan@mail.ru')).toBe('i***@mail.ru');
    expect(maskEmail('broken')).toBe('***');
  });
});

describe('sendTelegramMessage', () => {
  it('dry run: no network, ok', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    const result = await sendTelegramMessage('hi', {
      fetch: fetchMock,
      config: { dryRun: true, token: TOKEN, chatId: '1' },
    });
    expect(result).toEqual({ ok: true, dryRun: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('never touches the network under Vitest without an injected fetch', async () => {
    const globalFetch = vi.spyOn(globalThis, 'fetch');
    const result = await sendTelegramMessage('hi', { config: { dryRun: false, token: TOKEN, chatId: '1' } });
    expect(result.dryRun).toBe(true);
    expect(globalFetch).not.toHaveBeenCalled();
  });

  it('posts sendMessage with parse_mode HTML', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => jsonResponse({ ok: true, result: {} }));
    const result = await sendTelegramMessage('<b>hi</b>', { ...LIVE, fetch: fetchMock, sleep: noSleep });
    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toBe(`https://api.telegram.org/bot${TOKEN}/sendMessage`);
    expect(JSON.parse(String(init?.body))).toEqual({
      chat_id: '424242',
      text: '<b>hi</b>',
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
    });
  });

  it('retries 5xx / network errors twice with backoff, then succeeds', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(jsonResponse({ ok: false, error_code: 502, description: 'Bad Gateway' }, 502))
      .mockResolvedValueOnce(jsonResponse({ ok: true, result: {} }));
    const result = await sendTelegramMessage('hi', { ...LIVE, fetch: fetchMock, sleep: noSleep });
    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(noSleep.mock.calls.map(([ms]) => ms)).toEqual([...TELEGRAM_DEFAULTS.backoffMs]);
  });

  it('gives up after 1 + 2 attempts and returns the last error', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => jsonResponse({ ok: false, description: 'Internal' }, 500));
    const result = await sendTelegramMessage('hi', { ...LIVE, fetch: fetchMock, sleep: noSleep });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result).toEqual({ ok: false, error: apiError(500, 'Internal') });
  });

  it('does not retry client errors (e.g. chat not found)', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      jsonResponse({ ok: false, error_code: 400, description: 'Bad Request: chat not found' }, 400),
    );
    const result = await sendTelegramMessage('hi', { ...LIVE, fetch: fetchMock, sleep: noSleep });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ok: false, error: apiError(400, 'Bad Request: chat not found') });
  });

  it('words an API refusal without a description as telegram.errors.api too', async () => {
    const opts = { ...LIVE, sleep: noSleep, retries: 0 };
    const html = vi.fn<typeof fetch>(async () => new Response('<html>', { status: 502, statusText: 'Bad Gateway' }));
    await expect(sendTelegramMessage('hi', { ...opts, fetch: html })).resolves.toEqual({
      ok: false,
      error: apiError(502, 'Bad Gateway'),
    });
    const bare = vi.fn<typeof fetch>(async () => new Response(null, { status: 503 }));
    await expect(sendTelegramMessage('hi', { ...opts, fetch: bare })).resolves.toEqual({
      ok: false,
      error: apiError(503, copy.errors.unknown),
    });
  });

  it('honours retry_after on 429', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ ok: false, error_code: 429, parameters: { retry_after: 3 } }, 429))
      .mockResolvedValueOnce(jsonResponse({ ok: true, result: {} }));
    const result = await sendTelegramMessage('hi', { ...LIVE, fetch: fetchMock, sleep: noSleep });
    expect(result.ok).toBe(true);
    expect(noSleep).toHaveBeenCalledWith(3000);
  });

  it('never leaks the bot token in errors', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => {
      throw new Error(`connect failed for https://api.telegram.org/bot${TOKEN}/sendMessage`);
    });
    const result = await sendTelegramMessage('hi', { ...LIVE, fetch: fetchMock, sleep: noSleep });
    expect(result.ok).toBe(false);
    expect(result.error).not.toContain(TOKEN);
    expect(result.error).toContain('***');
  });

  it('reports a missing configuration without calling the API', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    const result = await sendTelegramMessage('hi', {
      fetch: fetchMock,
      config: { dryRun: false, token: '', chatId: '' },
    });
    expect(result).toEqual({ ok: false, error: copy.errors.notConfigured });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports a timeout with its message', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => {
      throw new DOMException('The operation timed out.', 'TimeoutError');
    });
    const result = await sendTelegramMessage('hi', { ...LIVE, fetch: fetchMock, sleep: noSleep, retries: 0 });
    expect(result).toEqual({ ok: false, error: copy.errors.timeout });
  });
});

describe('owner-facing copy', () => {
  it("reads telegram.* in the default locale, whatever the visitor's language", async () => {
    await loadTelegramText();
    expect(getTranslations).toHaveBeenCalledWith({ locale: 'ru', namespace: 'telegram' });
  });

  it('falls back to the bundled defaults when the messages cannot be read (the notification still goes out)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    getTranslations.mockRejectedValueOnce(new Error('db down'));
    const fallback = await loadTelegramText();
    expect(fallback('errors.dryRun')).toBe(copy.errors.dryRun);
  });

  it('formats the flood-ceiling status for Lead.telegramError', async () => {
    await expect(notifyCeilingError({ max: 60, windowMs: 10 * 60 * 1000 })).resolves.toBe(
      copy.errors.notifyCeiling.replace('{max}', '60').replace('{minutes}', '10'),
    );
  });
});

describe('sendLeadToTelegram', () => {
  it('dry run (TELEGRAM_DRY_RUN=1): logs a redacted preview, records it as NOT delivered, no network', async () => {
    expect(process.env.TELEGRAM_DRY_RUN).toBe('1');
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const fetchMock = vi.fn<typeof fetch>();
    const result = await sendLeadToTelegram(lead, { fetch: fetchMock });
    expect(result).toEqual({ ok: true, dryRun: true });
    expect(fetchMock).not.toHaveBeenCalled();
    const logged = info.mock.calls.map(call => call.join(' ')).join('\n');
    expect(logged).toContain('DRY RUN');
    expect(logged).toContain('+7******4567');
    expect(logged).not.toContain('+79001234567');
    expect(logged).not.toContain('ivan@mail.ru');
    expect(leadUpdate).toHaveBeenCalledWith({
      where: { id: 'clead123' },
      data: { telegramSent: false, telegramError: copy.errors.dryRun },
    });
  });

  it('records a real delivery as sent', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => jsonResponse({ ok: true, result: {} }));
    const result = await sendLeadToTelegram(lead, { ...LIVE, fetch: fetchMock, sleep: noSleep });
    expect(result).toEqual({ ok: true });
    expect(leadUpdate).toHaveBeenCalledWith({
      where: { id: 'clead123' },
      data: { telegramSent: true, telegramError: null },
    });
  });

  it('keeps the lead and records the error when Telegram fails', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchMock = vi.fn<typeof fetch>(async () =>
      jsonResponse({ ok: false, description: 'Forbidden: bot was blocked by the user' }, 403),
    );
    const result = await sendLeadToTelegram(lead, { ...LIVE, fetch: fetchMock, sleep: noSleep });
    const error = apiError(403, 'Forbidden: bot was blocked by the user');
    expect(result).toEqual({ ok: false, error });
    // Stored as the owner reads it in the admin: telegram.errors.api, Telegram's words as details.
    expect(error).toBe('Telegram отклонил сообщение (код 403): Forbidden: bot was blocked by the user');
    expect(leadUpdate).toHaveBeenCalledWith({
      where: { id: 'clead123' },
      data: { telegramSent: false, telegramError: error },
    });
  });

  it('never throws, even if recording the result fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    leadUpdate.mockRejectedValueOnce(new Error('db down'));
    await expect(sendLeadToTelegram(lead)).resolves.toEqual({ ok: true, dryRun: true });
  });
});

describe('resendLeadToTelegram', () => {
  it('returns the owner-facing error for an unknown lead', async () => {
    leadFindUnique.mockResolvedValueOnce(null);
    await expect(resendLeadToTelegram('missing')).resolves.toEqual({ ok: false, error: copy.errors.notFound });
    expect(leadUpdate).not.toHaveBeenCalled();
  });

  it('validates the id', async () => {
    await expect(resendLeadToTelegram('')).resolves.toEqual({ ok: false, error: copy.errors.invalidId });
    expect(leadFindUnique).not.toHaveBeenCalled();
  });

  it('loads the lead and reports a dry run as «not sent» (never as delivered)', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    leadFindUnique.mockResolvedValueOnce(lead);
    await expect(resendLeadToTelegram('clead123')).resolves.toEqual({ ok: false, error: copy.errors.dryRun });
    expect(leadFindUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'clead123' } }));
    expect(leadUpdate).toHaveBeenCalledWith({
      where: { id: 'clead123' },
      data: { telegramSent: false, telegramError: copy.errors.dryRun },
    });
  });
});
