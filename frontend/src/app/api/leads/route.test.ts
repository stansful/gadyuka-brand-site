import { createTranslator } from 'next-intl';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { LeadApiResponse } from '@/lib/leads';

import type * as NextServer from 'next/server';

import type { LeadStore } from './submit';

import en from '../../../../messages/en.json';
import ru from '../../../../messages/ru.json';

// ── mocks: no DB, no Telegram, no Next request scope ─────────────────────────
const scheduled: Array<() => Promise<void>> = [];
vi.mock('next/server', async importOriginal => {
  const actual = await importOriginal<typeof NextServer>();
  return { ...actual, after: (task: () => Promise<void>) => void scheduled.push(task) };
});

vi.mock('next-intl/server', () => ({
  getTranslations: async ({ locale, namespace }: { locale: 'ru' | 'en'; namespace: 'forms.errors' }) =>
    createTranslator({ locale, messages: locale === 'en' ? en : ru, namespace }),
}));

const store = {
  countRecentLeads: vi.fn(async (_ipHash: string, _since: Date) => 0),
  oldestLeadInWindow: vi.fn(async (_ipHash: string, _since: Date): Promise<Date | null> => null),
  countAllRecentLeads: vi.fn(async (_since: Date) => 0),
  insertLead: vi.fn(
    async (lead: {
      type: 'TAILORING' | 'PARTNERSHIP' | 'CONTACT';
      name: string;
      email: string | null;
      phone: string | null;
      message: string;
      locale: string;
    }) => ({
      id: 'lead-42',
      ...lead,
      createdAt: new Date('2026-10-16T12:00:00Z'),
    }),
  ),
};
const storeModule = {
  withLeadLock: async <T>(_ipHash: string, work: (current: LeadStore) => Promise<T>): Promise<T> =>
    work({
      countRecent: store.countRecentLeads,
      oldestInWindow: store.oldestLeadInWindow,
      countAllRecent: store.countAllRecentLeads,
      insert: lead => store.insertLead(lead),
    }),
};
vi.mock('./store', () => storeModule);

const sendLeadToTelegram = vi.fn(async () => ({ ok: true }));
const notifyCeilingError = vi.fn(async () => 'ceiling');
vi.mock('@/lib/telegram', () => ({ sendLeadToTelegram, notifyCeilingError }));

const { POST } = await import('./route');

function request(body: string | object, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost:3000/api/leads', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-real-ip': '203.0.113.7', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

async function call(req: NextRequest): Promise<{ status: number; body: LeadApiResponse; headers: Headers }> {
  const response = await POST(req);
  return { status: response.status, body: (await response.json()) as LeadApiResponse, headers: response.headers };
}

const valid = {
  type: 'CONTACT',
  name: 'Иван',
  email: 'ivan@mail.ru',
  message: 'Привет',
  locale: 'ru',
  consent: true,
  hp: '',
};

beforeEach(() => {
  scheduled.length = 0;
  store.countRecentLeads.mockClear().mockResolvedValue(0);
  store.insertLead.mockClear();
  sendLeadToTelegram.mockClear();
});

describe('POST /api/leads', () => {
  it('201: saves the lead and sends it to Telegram after the response', async () => {
    const { status, body, headers } = await call(request(valid));
    expect(status).toBe(201);
    expect(body).toEqual({ ok: true, id: 'lead-42' });
    expect(headers.get('cache-control')).toBe('no-store');
    expect(store.insertLead).toHaveBeenCalledTimes(1);
    expect(sendLeadToTelegram).not.toHaveBeenCalled();
    await scheduled[0]?.();
    expect(sendLeadToTelegram).toHaveBeenCalledWith(expect.objectContaining({ id: 'lead-42', email: 'ivan@mail.ru' }));
  });

  it('422: localized field errors (ru and en)', async () => {
    const ruResult = await call(request({ ...valid, email: 'bad', consent: false }));
    expect(ruResult.status).toBe(422);
    expect(ruResult.body).toEqual({
      ok: false,
      error: 'invalid_form',
      message: ru.forms.errors.invalidForm,
      fieldErrors: {
        email: ru.forms.errors.invalidEmail,
        consent: ru.forms.errors.consentRequired,
      },
    });

    const enResult = await call(request({ ...valid, type: 'TAILORING', email: '', name: 'I', locale: 'en' }));
    expect(enResult.status).toBe(422);
    expect(enResult.body).toMatchObject({
      message: en.forms.errors.invalidForm,
      fieldErrors: {
        name: en.forms.errors.tooShort.replace('{min}', '2'),
        contact: en.forms.errors.contactRequired,
      },
    });
    expect(store.insertLead).not.toHaveBeenCalled();
  });

  it('429: rate limited with Retry-After', async () => {
    store.countRecentLeads.mockResolvedValueOnce(5);
    const { status, body, headers } = await call(request(valid));
    expect(status).toBe(429);
    expect(body).toMatchObject({ ok: false, error: 'rate_limited', retryAfter: 600 });
    expect(headers.get('retry-after')).toBe('600');
    expect(store.insertLead).not.toHaveBeenCalled();
  });

  it('past the site-wide ceiling: saves the lead with the owner-facing status, no Telegram', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    store.countAllRecentLeads.mockResolvedValueOnce(60);
    const { status } = await call(request(valid));
    expect(status).toBe(201);
    expect(notifyCeilingError).toHaveBeenCalledWith(expect.objectContaining({ max: 60 }));
    expect(scheduled).toHaveLength(0);
  });

  it('hashes the client IP for the rate limit (never stores the raw IP)', async () => {
    await call(request(valid));
    const [ipHash] = store.countRecentLeads.mock.calls[0] ?? [];
    expect(ipHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(store.insertLead.mock.calls)).not.toContain('203.0.113.7');
  });

  it('201 without saving for honeypot hits', async () => {
    const { status, body } = await call(request({ ...valid, hp: 'http://spam' }));
    expect(status).toBe(201);
    expect(body.ok).toBe(true);
    expect(store.insertLead).not.toHaveBeenCalled();
    expect(scheduled).toHaveLength(0);
  });

  it('415 for bodies that are neither JSON nor a form post', async () => {
    const { status, body } = await call(request('name=x', { 'content-type': 'text/plain' }));
    expect(status).toBe(415);
    expect(body).toMatchObject({ ok: false, error: 'unsupported_media_type' });
  });

  it('400 for malformed JSON', async () => {
    const { status, body } = await call(request('{not json'));
    expect(status).toBe(400);
    expect(body).toMatchObject({ ok: false, error: 'bad_request' });
  });

  it('413 for oversized bodies', async () => {
    const { status, body } = await call(request({ ...valid, message: 'я'.repeat(20_000) }));
    expect(status).toBe(413);
    expect(body).toMatchObject({ ok: false, error: 'payload_too_large' });
  });

  it('500 in production without IP_HASH_SALT — never stores a reversible IP hash', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('IP_HASH_SALT', '');
    try {
      const { status, body } = await call(request(valid));
      expect(status).toBe(500);
      expect(body).toMatchObject({ ok: false, error: 'server_error' });
      expect(store.insertLead).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('500 when the DB is down — with a localized message, never a crash', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    store.insertLead.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const { status, body } = await call(request({ ...valid, locale: 'en' }));
    expect(status).toBe(500);
    expect(body).toEqual({ ok: false, error: 'server_error', message: en.forms.errors.server });
  });
});

describe('POST /api/leads — plain HTML form (no JS)', () => {
  function formRequest(fields: Record<string, string>, headers: Record<string, string> = {}): NextRequest {
    return new NextRequest('http://localhost:3000/api/leads', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-real-ip': '203.0.113.7', ...headers },
      body: new URLSearchParams(fields).toString(),
    });
  }

  const fields = {
    type: 'CONTACT',
    name: 'Иван',
    email: 'ivan@mail.ru',
    message: 'Привет',
    locale: 'ru',
    consent: 'on',
    hp: '',
  };

  it('303 back to the form after saving — the personal data never lands in a URL', async () => {
    const response = await POST(formRequest(fields));
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('/#lead-sent');
    expect(response.headers.get('location')).not.toContain('ivan');
    expect(store.insertLead).toHaveBeenCalledWith(expect.objectContaining({ email: 'ivan@mail.ru', name: 'Иван' }));
    await scheduled[0]?.();
    expect(sendLeadToTelegram).toHaveBeenCalledTimes(1);
  });

  it('303 to the localized landing; invalid forms are not stored', async () => {
    const response = await POST(formRequest({ ...fields, locale: 'en', consent: '' }));
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('/en#lead-invalid');
    expect(store.insertLead).not.toHaveBeenCalled();
  });

  it('303 to the failure notice when rate limited', async () => {
    store.countRecentLeads.mockResolvedValueOnce(5);
    const response = await POST(formRequest(fields));
    expect(response.headers.get('location')).toBe('/#lead-failed');
    expect(store.insertLead).not.toHaveBeenCalled();
  });

  it('refuses cross-site form posts', async () => {
    const response = await POST(formRequest(fields, { 'sec-fetch-site': 'cross-site' }));
    expect(response.status).toBe(403);
    expect(store.insertLead).not.toHaveBeenCalled();
  });
});
