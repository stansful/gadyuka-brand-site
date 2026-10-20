import { notFound } from 'next/navigation';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { MessageRow } from './messages';

import adminRu from '../../messages/admin/ru.json';
import en from '../../messages/en.json';
import ru from '../../messages/ru.json';

// ── mocks: no Next.js request scope, no Postgres ─────────────────────────────
const findMany = vi.fn(async (_args: unknown): Promise<MessageRow[]> => []);
vi.mock('@/lib/db', () => ({ db: { message: { findMany } } }));
vi.mock('next/cache', () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));
vi.mock('@/lib/content/cache', () => ({ CACHE_TAGS: { content: 'content' }, CONTENT_CACHE_LIFE: 'hours' }));
// The request config as written (next-intl's wrapper only registers it).
vi.mock('next-intl/server', () => ({ getRequestConfig: <T>(create: T): T => create }));
// Outside the [locale] tree (a Route Handler, /admin): the root param is not available.
vi.mock('next/root-params', () => ({
  locale: async (): Promise<string> => {
    throw new Error('root params are not available here');
  },
}));

const { loadSiteMessages } = await import('./site-messages');
const { default: requestConfig } = await import('./request');

const dbDown = (): Promise<never> => Promise.reject(new Error('connect ECONNREFUSED 127.0.0.1:5432'));

let logged: { error: ReturnType<typeof vi.spyOn> };

/** performance.now() as the module sees it (the fallback log interval). */
let clock = 0;
const FALLBACK_LOG_INTERVAL_MS = 60_000;

beforeEach(() => {
  findMany.mockReset().mockResolvedValue([]);
  logged = { error: vi.spyOn(console, 'error').mockImplementation(() => undefined) };
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  // Every test starts well past the log interval of the previous one (the module keeps its state).
  clock += 10 * FALLBACK_LOG_INTERVAL_MS;
  vi.spyOn(performance, 'now').mockImplementation(() => clock);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('loadSiteMessages', () => {
  it('serves the DB rows over the JSON defaults while the database is up', async () => {
    findMany.mockResolvedValueOnce([{ key: 'error.title', locale: 'ru', value: 'Сбой' }]);
    const messages = await loadSiteMessages('ru');
    expect(messages.error.title).toBe('Сбой');
    expect(messages.error.retry).toBe(ru.error.retry);
    expect(logged.error).not.toHaveBeenCalled();
  });

  it('falls back to the bundled defaults when the database is down, not memoizing the fallback', async () => {
    findMany.mockImplementation(dbDown);
    await expect(loadSiteMessages('en')).resolves.toEqual(en);
    await expect(loadSiteMessages('en')).resolves.toEqual(en);
    expect(findMany).toHaveBeenCalledTimes(2); // every read tries the DB again
    expect(logged.error).toHaveBeenCalledOnce();

    // The database is back: the edited copy returns on the next read.
    findMany.mockReset().mockResolvedValue([{ key: 'error.title', locale: 'en', value: 'Oops' }]);
    expect((await loadSiteMessages('en')).error.title).toBe('Oops');
  });

  it('logs an outage once per locale and interval, even when cache hits succeed in between', async () => {
    findMany.mockImplementation(dbDown);
    await loadSiteMessages('ru');
    await loadSiteMessages('en');
    expect(logged.error).toHaveBeenCalledTimes(2); // one line per locale

    // A render served by a cache entry from before the outage succeeds; the next uncached one
    // fails again. Still the same outage: no new line (this used to log on every such flip).
    clock += 1_000;
    findMany.mockResolvedValueOnce([]);
    await loadSiteMessages('ru');
    await loadSiteMessages('ru');
    expect(logged.error).toHaveBeenCalledTimes(2);

    // Still down a minute later: logged again, so a long outage stays visible in the logs.
    clock += FALLBACK_LOG_INTERVAL_MS;
    await loadSiteMessages('ru');
    expect(logged.error).toHaveBeenCalledTimes(3);
    expect(logged.error).toHaveBeenLastCalledWith(
      expect.stringContaining('cannot read the ru site messages'),
      expect.any(Error),
    );
  });

  it('lets Next.js control flow through (it is not a database failure)', async () => {
    findMany.mockImplementation(async () => notFound());
    await expect(loadSiteMessages('ru')).rejects.toThrow();
    expect(logged.error).not.toHaveBeenCalled();
  });
});

describe('next-intl request config', () => {
  it('still resolves when the database is down: bundled site defaults + the admin namespace', async () => {
    findMany.mockImplementation(dbDown);
    const config = await requestConfig({ locale: 'en', requestLocale: Promise.resolve(undefined) });
    expect(config.locale).toBe('en');
    // What POST /api/leads needs for its JSON errors, and the admin (login included) for its copy.
    expect(config.messages).toMatchObject({
      forms: { errors: { server: en.forms.errors.server } },
      admin: { auth: { title: adminRu.admin.auth.title } },
    });
  });

  it('uses the default locale outside the [locale] tree', async () => {
    const config = await requestConfig({ requestLocale: Promise.resolve(undefined) });
    expect(config.locale).toBe('ru');
    expect(config.messages).toMatchObject({ error: ru.error, admin: adminRu.admin });
  });
});
