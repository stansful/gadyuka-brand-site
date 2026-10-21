import { notFound } from 'next/navigation';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SiteMessagesResponse } from '@shared/contracts/content';
import adminRu from '@shared/messages/admin/ru.json';
import en from '@shared/messages/en.json';
import ru from '@shared/messages/ru.json';

// ── mocks: no Next.js request scope, no backend ──────────────────────────────
type Edit = { key: string; locale: 'ru' | 'en'; value: string };
/** GET /public/messages/:locale as the backend answers it: the defaults with `edits` applied. */
type MutableTree = { [key: string]: string | MutableTree };
const backendMessages = (locale: 'ru' | 'en', edits: Edit[]): SiteMessagesResponse => {
  const tree: MutableTree = structuredClone(locale === 'ru' ? ru : en);
  for (const edit of edits.filter(item => item.locale === locale)) {
    const [namespace = '', key = ''] = edit.key.split('.');
    const branch = tree[namespace];
    if (typeof branch === 'object') branch[key] = edit.value;
  }
  return { locale, messages: tree };
};
let edits: Edit[] = [];
const answerFromBackend = async (path: string): Promise<SiteMessagesResponse> =>
  backendMessages(path.endsWith('/en') ? 'en' : 'ru', edits);
const readMessages = vi.fn(answerFromBackend);
vi.mock('@/lib/api/public', () => ({ cachedPublicRead: readMessages }));
vi.mock('next/server', () => ({ connection: async (): Promise<void> => undefined }));
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

const backendDown = (): Promise<never> => Promise.reject(new Error('Backend request failed: unavailable: network'));

let logged: { error: ReturnType<typeof vi.spyOn> };

/** performance.now() as the module sees it (the fallback log interval). */
let clock = 0;
const FALLBACK_LOG_INTERVAL_MS = 60_000;

beforeEach(() => {
  edits = [];
  readMessages.mockReset().mockImplementation(answerFromBackend);
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
  it('serves the backend messages (admin edits over the defaults) while the backend is up', async () => {
    edits = [{ key: 'error.title', locale: 'ru', value: 'Сбой' }];
    const messages = await loadSiteMessages('ru');
    expect(messages.error.title).toBe('Сбой');
    expect(messages.error.retry).toBe(ru.error.retry);
    expect(logged.error).not.toHaveBeenCalled();
  });

  it('falls back to the bundled defaults when the backend is down, not memoizing the fallback', async () => {
    readMessages.mockImplementationOnce(backendDown).mockImplementationOnce(backendDown);
    await expect(loadSiteMessages('en')).resolves.toEqual(en);
    await expect(loadSiteMessages('en')).resolves.toEqual(en);
    expect(readMessages).toHaveBeenCalledTimes(2); // every read tries the backend again
    expect(logged.error).toHaveBeenCalledOnce();

    // The backend is back: the edited copy returns on the next read.
    edits = [{ key: 'error.title', locale: 'en', value: 'Oops' }];
    expect((await loadSiteMessages('en')).error.title).toBe('Oops');
  });

  it('keeps every key of the bundled messages and ignores keys the frontend does not know', async () => {
    readMessages.mockResolvedValueOnce({
      locale: 'ru',
      messages: { error: { title: 'Сбой', extra: 'x' }, removed: 'y' },
    });
    const messages = await loadSiteMessages('ru');
    expect(messages.error.title).toBe('Сбой');
    expect(messages.hero).toEqual(ru.hero);
    expect(messages).not.toHaveProperty('removed');
  });

  it('logs an outage once per locale and interval, even when cache hits succeed in between', async () => {
    readMessages.mockImplementation(backendDown);
    await loadSiteMessages('ru');
    await loadSiteMessages('en');
    expect(logged.error).toHaveBeenCalledTimes(2); // one line per locale

    // A render served by a cache entry from before the outage succeeds; the next uncached one
    // fails again. Still the same outage: no new line (this used to log on every such flip).
    clock += 1_000;
    readMessages.mockResolvedValueOnce(backendMessages('ru', []));
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

  it('lets Next.js control flow through (it is not a backend failure)', async () => {
    readMessages.mockImplementationOnce(async () => notFound());
    await expect(loadSiteMessages('ru')).rejects.toThrow();
    expect(logged.error).not.toHaveBeenCalled();
  });
});

describe('next-intl request config', () => {
  it('still resolves when the backend is down: bundled site defaults + the admin namespace', async () => {
    readMessages.mockImplementationOnce(backendDown);
    const config = await requestConfig({ locale: 'en', requestLocale: Promise.resolve(undefined) });
    expect(config.locale).toBe('en');
    // What POST /api/leads needs for its JSON errors, and the admin (login included) for its copy.
    expect(config.messages).toMatchObject({
      forms: { errors: { server: en.forms.errors.server } },
      admin: { auth: { title: adminRu.admin.auth.title } },
    });
  });

  it('uses the default locale and the bundled site messages outside the [locale] tree (no backend call)', async () => {
    edits = [{ key: 'error.title', locale: 'ru', value: 'Сбой' }];
    const config = await requestConfig({ requestLocale: Promise.resolve(undefined) });
    expect(config.locale).toBe('ru');
    expect(config.messages).toMatchObject({ error: ru.error, admin: adminRu.admin });
    expect(readMessages).not.toHaveBeenCalled();
  });

  it('reads the edited site messages for an explicit locale (Route Handlers, Server Actions)', async () => {
    edits = [{ key: 'error.title', locale: 'en', value: 'Oops' }];
    const config = await requestConfig({ locale: 'en', requestLocale: Promise.resolve(undefined) });
    expect(config.messages).toMatchObject({ error: { title: 'Oops' } });
  });
});
