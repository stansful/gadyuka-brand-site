import { beforeEach, describe, expect, it, vi } from 'vitest';

import { defaultMessage, isMessageKey, type MessageKey } from '@/i18n/messages';

import type { SiteTextsInput } from '../schemas';

/**
 * saveSiteTexts / resetSiteText against an in-memory Message / ContentImage table: the
 * optimistic concurrency of «Тексты сайта» end to end (payload → lock → conflict check → writes).
 */

type MessageRow = { key: string; locale: string; value: string; editedAt: Date | null };
type ImageRow = { key: string; mediaId: string | null };

const messages = new Map<string, MessageRow>();
const images = new Map<string, ImageRow>();
/** The order of the DB calls inside the transaction ("lock", "read", "write"). */
const calls: string[] = [];

const rowId = (key: string, locale: string): string => `${locale}\u0000${key}`;

const tx = {
  $executeRaw: vi.fn(async () => {
    calls.push('lock');
    return 1;
  }),
  message: {
    findMany: vi.fn(async ({ where }: { where: { key: { in: string[] }; locale: { in: string[] } } }) => {
      calls.push('read');
      return [...messages.values()].filter(
        row => where.key.in.includes(row.key) && where.locale.in.includes(row.locale),
      );
    }),
    upsert: vi.fn(
      async ({
        create,
        update,
      }: {
        create: MessageRow;
        update: Pick<MessageRow, 'value' | 'editedAt'>;
      }): Promise<{ key: string }> => {
        calls.push('write');
        const id = rowId(create.key, create.locale);
        const existing = messages.get(id);
        messages.set(id, existing ? { ...existing, ...update } : { ...create });
        return { key: create.key };
      },
    ),
  },
  contentImage: {
    findMany: vi.fn(async ({ where }: { where: { key: { in: string[] } } }) =>
      [...images.values()].filter(row => where.key.in.includes(row.key)),
    ),
    upsert: vi.fn(async ({ create }: { create: ImageRow }): Promise<{ key: string }> => {
      calls.push('write');
      images.set(create.key, { ...create });
      return { key: create.key };
    }),
  },
};

const db = {
  $transaction: vi.fn(async <T>(work: (client: typeof tx) => Promise<T>): Promise<T> => work(tx)),
  media: {
    findMany: vi.fn(async ({ where }: { where: { id: { in: string[] } } }) => where.id.in.map(id => ({ id }))),
  },
};

vi.mock('@/lib/db', () => ({ db }));
vi.mock('../auth', () => ({
  AdminAuthError: class AdminAuthError extends Error {},
  requireAdminAction: async () => ({ allowed: true }),
}));
const revalidateContent = vi.fn();
vi.mock('@/lib/content/cache', () => ({ revalidateContent }));
vi.mock('next-intl/server', async () => (await import('../../../../test/admin-intl')).nextIntlServerMock);

const { resetSiteText, saveSiteTexts } = await import('./content');

function messageKey(key: string): MessageKey {
  if (!isMessageKey(key)) throw new Error(`messages/ru.json has no ${key}`);
  return key;
}

const TITLE = messageKey('hero.title');
const SLOGAN = messageKey('hero.slogan');
const EDITED_AT = new Date('2026-10-20T10:00:00.000Z');

function store(key: MessageKey, locale: 'ru' | 'en', value: string, editedAt: Date | null = null): void {
  messages.set(rowId(key, locale), { key, locale, value, editedAt });
}

function stored(key: MessageKey, locale: 'ru' | 'en'): MessageRow | undefined {
  return messages.get(rowId(key, locale));
}

function save(entries: SiteTextsInput['entries'], pictures: SiteTextsInput['images'] = []) {
  return saveSiteTexts({ entries, images: pictures });
}

beforeEach(() => {
  messages.clear();
  images.clear();
  calls.length = 0;
  vi.clearAllMocks();
  for (const key of [TITLE, SLOGAN]) {
    for (const locale of ['ru', 'en'] as const) store(key, locale, defaultMessage(key, locale));
  }
});

describe('saveSiteTexts: a stale tab never overwrites a newer text', () => {
  it('refuses an edit of a text changed in another tab, names it and writes nothing', async () => {
    // Tab 2 saves «ГАДЮКА 2.0» while tab 1 still shows the default title.
    store(TITLE, 'ru', 'ГАДЮКА 2.0', EDITED_AT);
    const result = await save([
      { key: SLOGAN, values: { ru: { value: 'Новый слоган', base: defaultMessage(SLOGAN, 'ru') } } },
      { key: TITLE, values: { ru: { value: 'Моя правка', base: defaultMessage(TITLE, 'ru') } } },
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/^Ничего не сохранено/);
    expect(result.error).toContain('(RU)');
    expect(result.fieldErrors?.[`${TITLE}.ru`]).toContain('«ГАДЮКА 2.0»');
    expect(stored(TITLE, 'ru')?.value).toBe('ГАДЮКА 2.0');
    expect(stored(SLOGAN, 'ru')?.value).toBe(defaultMessage(SLOGAN, 'ru'));
    expect(tx.message.upsert).not.toHaveBeenCalled();
    expect(revalidateContent).not.toHaveBeenCalled();
  });

  it('saves the edits of the stale tab that do not collide, leaving the newer text alone', async () => {
    store(TITLE, 'ru', 'ГАДЮКА 2.0', EDITED_AT);
    const result = await save([
      { key: SLOGAN, values: { ru: { value: ' Новый слоган ', base: defaultMessage(SLOGAN, 'ru') } } },
    ]);
    expect(result).toEqual({
      ok: true,
      data: { saved: 1, values: { [SLOGAN]: { ru: 'Новый слоган' } } },
      message: 'Тексты сохранены — сайт обновлён',
    });
    expect(stored(SLOGAN, 'ru')).toMatchObject({ value: 'Новый слоган', editedAt: expect.any(Date) });
    expect(stored(TITLE, 'ru')?.value).toBe('ГАДЮКА 2.0');
    expect(revalidateContent).toHaveBeenCalledTimes(1);
  });

  it('checks and writes under the «Тексты сайта» lock, inside one transaction', async () => {
    await save([{ key: SLOGAN, values: { ru: { value: 'Новый слоган', base: defaultMessage(SLOGAN, 'ru') } } }]);
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(calls).toEqual(['lock', 'read', 'write']);
  });

  it('creates a missing row with the default and never writes a resent text over a row', async () => {
    messages.delete(rowId(TITLE, 'en'));
    store(TITLE, 'ru', 'ГАДЮКА 2.0', EDITED_AT);
    const ru = defaultMessage(TITLE, 'ru');
    const result = await save([
      { key: TITLE, values: { ru: { value: ru, base: ru }, en: { value: 'Outdated', base: 'Outdated' } } },
    ]);
    expect(result.ok && result.data).toEqual({
      saved: 1,
      values: { [TITLE]: { ru: 'ГАДЮКА 2.0', en: defaultMessage(TITLE, 'en') } },
    });
    expect(stored(TITLE, 'en')).toEqual({
      key: TITLE,
      locale: 'en',
      value: defaultMessage(TITLE, 'en'),
      editedAt: null,
    });
    expect(stored(TITLE, 'ru')?.value).toBe('ГАДЮКА 2.0');
  });

  it('reports «no changes» without a transaction when nothing was sent', async () => {
    const result = await save([]);
    expect(result).toEqual({ ok: true, data: { saved: 0, values: {} }, message: 'Изменений нет — всё уже сохранено' });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('refuses an image replaced in another tab meanwhile', async () => {
    images.set('about.image', { key: 'about.image', mediaId: 'm3' });
    const result = await save([], [{ key: 'about.image', mediaId: 'm2', base: 'm1' }]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('картинку «Фото»');
      expect(result.fieldErrors?.['about.image']).toMatch(/обновите страницу/);
    }
    expect(images.get('about.image')?.mediaId).toBe('m3');
  });

  it('still validates every edited value (keyed "<key>.<locale>")', async () => {
    const result = await save([{ key: TITLE, values: { ru: { value: '', base: defaultMessage(TITLE, 'ru') } } }]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors?.[`${TITLE}.ru`]).toMatch(/^Обязательный текст/);
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});

describe('resetSiteText', () => {
  it('stores the defaults under the same lock', async () => {
    store(TITLE, 'ru', 'ГАДЮКА 2.0', EDITED_AT);
    const result = await resetSiteText(TITLE);
    expect(result.ok && result.data.values.ru).toBe(defaultMessage(TITLE, 'ru'));
    expect(calls).toEqual(['lock', 'write', 'write']);
    expect(stored(TITLE, 'ru')).toMatchObject({ value: defaultMessage(TITLE, 'ru'), editedAt: null });
  });
});
