import { createTranslator } from 'next-intl';
import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

import type { LeadApiResponse } from '@/lib/leads';

import type * as NextServer from 'next/server';

import en from '../../../../messages/en.json';
import ru from '../../../../messages/ru.json';

/**
 * POST /api/leads while Postgres is down — through the REAL next-intl request config
 * (src/i18n/request.ts), whose site messages come from the DB: the error messages must still
 * resolve (bundled defaults), so the documented JSON contract holds on every path.
 */

const refused = (): Promise<never> => Promise.reject(new Error('connect ECONNREFUSED 127.0.0.1:5432'));

vi.mock('@/lib/db', () => ({ db: { message: { findMany: refused } } }));
vi.mock('./store', () => ({ withLeadLock: refused }));
vi.mock('next/cache', () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));
vi.mock('@/lib/content/cache', () => ({ CACHE_TAGS: { content: 'content' }, CONTENT_CACHE_LIFE: 'hours' }));
vi.mock('@/lib/telegram', () => ({ sendLeadToTelegram: vi.fn(), notifyCeilingError: vi.fn() }));
vi.mock('next/server', async importOriginal => ({ ...(await importOriginal<typeof NextServer>()), after: vi.fn() }));
// A Route Handler has no [locale] root param.
vi.mock('next/root-params', () => ({
  locale: async (): Promise<string> => {
    throw new Error('root params are not available in a Route Handler');
  },
}));
// next-intl's getTranslations = the request config + a translator over its messages.
vi.mock('next-intl/server', () => ({
  getRequestConfig: <T>(create: T): T => create,
  getTranslations: async ({ locale, namespace }: { locale: 'ru' | 'en'; namespace: 'forms.errors' }) => {
    const { default: requestConfig } = await import('@/i18n/request');
    const { messages } = await requestConfig({ locale, requestLocale: Promise.resolve(undefined) });
    if (!messages) throw new Error('the request config returned no messages');
    return createTranslator({ locale, messages, namespace });
  },
}));

const { POST } = await import('./route');

function request(body: string, contentType = 'application/json'): NextRequest {
  return new NextRequest('http://localhost:3000/api/leads', {
    method: 'POST',
    headers: { 'content-type': contentType, 'x-real-ip': '203.0.113.7' },
    body,
  });
}

async function call(req: NextRequest): Promise<{ status: number; body: LeadApiResponse; cache: string | null }> {
  const response = await POST(req);
  return {
    status: response.status,
    body: (await response.json()) as LeadApiResponse,
    cache: response.headers.get('cache-control'),
  };
}

describe('POST /api/leads with the database down', () => {
  it('500 server_error as JSON, with the localized message', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const lead = { type: 'CONTACT', name: 'Ivan', email: 'ivan@mail.ru', message: 'Hi', locale: 'en', consent: true };
    await expect(call(request(JSON.stringify(lead)))).resolves.toEqual({
      status: 500,
      body: { ok: false, error: 'server_error', message: en.forms.errors.server },
      cache: 'no-store',
    });
  });

  it('415 / 400 stay JSON too', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(call(request('name=x', 'text/plain'))).resolves.toMatchObject({
      status: 415,
      body: { ok: false, error: 'unsupported_media_type', message: ru.forms.errors.unsupportedMediaType },
    });
    await expect(call(request('{not json'))).resolves.toMatchObject({
      status: 400,
      body: { ok: false, error: 'bad_request', message: ru.forms.errors.badRequest },
    });
  });
});
