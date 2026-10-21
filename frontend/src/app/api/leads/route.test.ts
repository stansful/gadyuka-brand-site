import { createTranslator } from 'next-intl';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { LeadApiResponse } from '@/lib/leads';
import en from '@shared/messages/en.json';
import ru from '@shared/messages/ru.json';

// ── mocks: the backend is a stubbed fetch, the request scope a header holder ──
let requestHeaders = new Headers();
vi.mock('next/headers', () => ({ headers: async () => requestHeaders }));

vi.mock('next-intl/server', () => ({
  getTranslations: async ({ locale, namespace }: { locale: 'ru' | 'en'; namespace: 'forms.errors' }) =>
    createTranslator({ locale, messages: locale === 'en' ? en : ru, namespace }),
}));

const { POST } = await import('./route');

const KEY = 'k'.repeat(40);
const BACKEND = 'http://backend.test:4000';
const fetchMock = vi.fn<typeof fetch>();

function backendAnswer(body: unknown, status = 201): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function sent(): { url: string; headers: Headers; body: unknown } {
  const [url, init = {}] = fetchMock.mock.calls[0] ?? [];
  return { url: String(url), headers: new Headers(init.headers), body: JSON.parse(String(init.body)) };
}

function request(body: string | object, headers: Record<string, string> = {}): NextRequest {
  const req = new NextRequest('http://localhost:3000/api/leads', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-real-ip': '203.0.113.7', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
  requestHeaders = req.headers;
  return req;
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
  vi.stubEnv('BACKEND_URL', BACKEND);
  vi.stubEnv('INTERNAL_API_KEY', KEY);
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(backendAnswer({ id: 'lead-42' }));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('POST /api/leads', () => {
  it('201: forwards the form to the backend for the visitor and answers its id', async () => {
    const { status, body, headers } = await call(
      request(
        { ...valid, debug: true },
        { referer: 'https://gadyuka.ru/', 'user-agent': 'Mozilla/5.0', 'x-client-ip': '6.6.6.6' },
      ),
    );
    expect(status).toBe(201);
    expect(body).toEqual({ ok: true, id: 'lead-42' });
    expect(headers.get('cache-control')).toBe('no-store');
    const forwarded = sent();
    expect(forwarded.url).toBe(`${BACKEND}/api/v1/public/leads`);
    expect(forwarded.body).toEqual({ ...valid, referer: 'https://gadyuka.ru/' });
    expect(forwarded.headers.get('x-internal-key')).toBe(KEY);
    expect(forwarded.headers.get('x-client-ip')).toBe('203.0.113.7');
    // The visitor's browser in its own header: the request's user-agent is this server's fetch ("node").
    expect(forwarded.headers.get('x-client-user-agent')).toBe('Mozilla/5.0');
    expect(forwarded.headers.has('user-agent')).toBe(false);
  });

  it('forwards the values as received (the backend checks their types) and no fields of a non-object', async () => {
    await call(request({ type: 'TAILORING', name: 42, consent: 'yes', hp: null }));
    expect(sent().body).toEqual({ type: 'TAILORING', name: 42, consent: 'yes', hp: null });
    fetchMock.mockClear();
    await call(request('["not", "an", "object"]'));
    expect(sent().body).toEqual({});
  });

  it('422: the backend field errors in the visitor language (ru and en)', async () => {
    fetchMock.mockResolvedValueOnce(
      backendAnswer(
        {
          statusCode: 400,
          error: 'validation',
          fields: {
            email: { key: 'forms.errors.invalidEmail' },
            consent: { key: 'forms.errors.consentRequired' },
          },
        },
        400,
      ),
    );
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

    fetchMock.mockResolvedValueOnce(
      backendAnswer(
        {
          statusCode: 400,
          error: 'validation',
          fields: {
            name: { key: 'forms.errors.tooShort', values: { min: 2 } },
            contact: { key: 'forms.errors.contactRequired' },
          },
        },
        400,
      ),
    );
    const enResult = await call(request({ ...valid, type: 'TAILORING', email: '', name: 'I', locale: 'en' }));
    expect(enResult.status).toBe(422);
    expect(enResult.body).toMatchObject({
      message: en.forms.errors.invalidForm,
      fieldErrors: {
        name: en.forms.errors.tooShort.replace('{min}', '2'),
        contact: en.forms.errors.contactRequired,
      },
    });
  });

  it('429: rate limited with Retry-After', async () => {
    fetchMock.mockResolvedValueOnce(
      backendAnswer(
        {
          statusCode: 429,
          error: 'throttled',
          key: 'forms.errors.rateLimited',
          details: { retryAfterSeconds: 600 },
        },
        429,
      ),
    );
    const { status, body, headers } = await call(request(valid));
    expect(status).toBe(429);
    expect(body).toEqual({ ok: false, error: 'rate_limited', message: ru.forms.errors.rateLimited, retryAfter: 600 });
    expect(headers.get('retry-after')).toBe('600');
  });

  it('415 for bodies that are neither JSON nor a form post (no backend call)', async () => {
    const { status, body } = await call(request('name=x', { 'content-type': 'text/plain' }));
    expect(status).toBe(415);
    expect(body).toMatchObject({ ok: false, error: 'unsupported_media_type' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('400 for malformed JSON', async () => {
    const { status, body } = await call(request('{not json'));
    expect(status).toBe(400);
    expect(body).toMatchObject({ ok: false, error: 'bad_request' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('413 for oversized bodies', async () => {
    const { status, body } = await call(request({ ...valid, message: 'я'.repeat(20_000) }));
    expect(status).toBe(413);
    expect(body).toMatchObject({ ok: false, error: 'payload_too_large' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('500 when the backend is down or fails — with a localized message, never a crash', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
    expect(await call(request({ ...valid, locale: 'en' }))).toMatchObject({
      status: 500,
      body: { ok: false, error: 'server_error', message: en.forms.errors.server },
    });
    fetchMock.mockResolvedValueOnce(
      backendAnswer({ statusCode: 500, error: 'internal', key: 'admin.errors.actionFailed' }, 500),
    );
    expect(await call(request(valid))).toMatchObject({
      status: 500,
      body: { ok: false, error: 'server_error', message: ru.forms.errors.server },
    });
  });
});

describe('POST /api/leads — plain HTML form (no JS)', () => {
  function formRequest(fields: Record<string, string>, headers: Record<string, string> = {}): NextRequest {
    const req = new NextRequest('http://localhost:3000/api/leads', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-real-ip': '203.0.113.7', ...headers },
      body: new URLSearchParams(fields).toString(),
    });
    requestHeaders = req.headers;
    return req;
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
    expect(sent().body).toEqual({ ...fields, consent: true });
  });

  it('303 to the localized landing when the backend refuses the form', async () => {
    fetchMock.mockResolvedValueOnce(
      backendAnswer(
        { statusCode: 400, error: 'validation', fields: { consent: { key: 'forms.errors.consentRequired' } } },
        400,
      ),
    );
    const response = await POST(formRequest({ ...fields, locale: 'en', consent: '' }));
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('/en#lead-invalid');
    expect(sent().body).toMatchObject({ consent: false, locale: 'en' });
  });

  it('303 to the failure notice when rate limited or the backend is down', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    fetchMock.mockResolvedValueOnce(
      backendAnswer({ statusCode: 429, error: 'throttled', key: 'forms.errors.rateLimited' }, 429),
    );
    expect((await POST(formRequest(fields))).headers.get('location')).toBe('/#lead-failed');
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
    expect((await POST(formRequest(fields))).headers.get('location')).toBe('/#lead-failed');
  });

  it('refuses cross-site form posts', async () => {
    const response = await POST(formRequest(fields, { 'sec-fetch-site': 'cross-site' }));
    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
