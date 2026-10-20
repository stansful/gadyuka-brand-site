import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_MESSAGES, resolveMessages, resolveMessageValues, type MessageRow } from '@/i18n/messages';

vi.mock('@/lib/db', () => ({ db: {} }));

const { offerExpiryCacheLife, ratingOnScale, toMenuItems, toSocialLinks } = await import('./landing');

const now = new Date('2026-10-16T20:00:00.000Z');
const at = (minutes: number): Date => new Date(now.getTime() + minutes * 60_000);

describe('offerExpiryCacheLife', () => {
  it('keeps the regular profile without offers expiring within the hour', () => {
    expect(offerExpiryCacheLife([], now)).toBeNull();
    expect(offerExpiryCacheLife([{ validUntil: null }, { validUntil: at(90) }], now)).toBeNull();
  });

  it('revalidates right after the earliest upcoming expiry', () => {
    expect(offerExpiryCacheLife([{ validUntil: at(30) }, { validUntil: at(10) }, { validUntil: null }], now)).toEqual({
      stale: 300,
      revalidate: 10 * 60 + 1,
      expire: 86_400,
    });
  });

  it('never revalidates more often than once a minute', () => {
    expect(offerExpiryCacheLife([{ validUntil: new Date(now.getTime() + 5_000) }], now)?.revalidate).toBe(60);
  });
});

describe('site messages: DB rows over the JSON defaults', () => {
  const row = (key: string, locale: string, value: string): MessageRow => ({ key, locale, value });

  it('shows the default of the locale for a key without a DB row (not seeded yet)', () => {
    expect(resolveMessageValues('ru', [])['common.chapterNo']).toBe(DEFAULT_MESSAGES.ru.common.chapterNo);
    expect(resolveMessageValues('en', [])['common.chapterNo']).toBe(DEFAULT_MESSAGES.en.common.chapterNo);
  });

  it('lets a DB row override the default — only for its own locale', () => {
    const rows = [row('common.chapterNo', 'ru', 'Часть {number}'), row('common.chapterNo', 'en', 'Part {number}')];
    expect(resolveMessageValues('ru', rows)['common.chapterNo']).toBe('Часть {number}');
    expect(resolveMessageValues('en', rows)['common.chapterNo']).toBe('Part {number}');
    expect(resolveMessageValues('en', [row('common.chapterNo', 'ru', 'Часть {number}')])['common.chapterNo']).toBe(
      DEFAULT_MESSAGES.en.common.chapterNo,
    );
  });

  it('keeps a key emptied in the default locale empty, and shows it for an emptied translation', () => {
    expect(resolveMessageValues('ru', [row('offers.fine', 'ru', '')])['offers.fine']).toBe('');
    const rows = [row('footer.trademark', 'ru', 'Знак'), row('footer.trademark', 'en', '  ')];
    expect(resolveMessageValues('en', rows)['footer.trademark']).toBe('Знак');
    expect(resolveMessageValues('en', [row('footer.trademark', 'en', '')])['footer.trademark']).toBe(
      DEFAULT_MESSAGES.ru.footer.trademark,
    );
    const both = [row('footer.trademark', 'ru', ''), row('footer.trademark', 'en', '')];
    expect(resolveMessageValues('en', both)['footer.trademark']).toBe('');
  });

  it('ignores orphan rows (keys no longer in messages/*.json, branch paths)', () => {
    const rows = [row('hero.city', 'ru', 'Москва'), row('forms.errors', 'ru', 'x'), row('hero', 'ru', 'x')];
    const values = resolveMessageValues('ru', rows);
    expect(Object.keys(values)).not.toContain('hero.city');
    expect(resolveMessages('ru', rows)).toEqual(DEFAULT_MESSAGES.ru);
  });

  it('builds the nested tree next-intl reads, without touching the defaults', () => {
    const tree = resolveMessages('en', [row('about.advantages.0.title', 'en', 'Own designs')]);
    expect(tree.about.advantages['0'].title).toBe('Own designs');
    expect(tree.forms.errors.tooShort).toBe(DEFAULT_MESSAGES.en.forms.errors.tooShort);
    expect(DEFAULT_MESSAGES.en.about.advantages['0'].title).not.toBe('Own designs');
  });
});

describe('menu, social links, ratings', () => {
  const item = { id: 'm1', href: '#about', showInHeader: true, showInFooter: false };

  it('localizes menu labels (ru fallback) and skips items without any label', () => {
    expect(toMenuItems([{ ...item, label: { ru: 'О нас', en: 'About' } }], 'en')).toEqual([
      { ...item, label: 'About' },
    ]);
    expect(toMenuItems([{ ...item, label: { ru: 'О нас' } }], 'en')).toEqual([{ ...item, label: 'О нас' }]);
    expect(toMenuItems([{ ...item, label: {} }], 'ru')).toEqual([]);
  });

  it('leaves an empty social label null (the site then shows social.<type>)', () => {
    const link = { id: 's1', type: 'TELEGRAM' as const, url: 'https://t.me/gadyuka' };
    expect(toSocialLinks([{ ...link, label: {} }], 'ru')).toEqual([{ ...link, label: null }]);
    expect(toSocialLinks([{ ...link, label: { ru: 'Канал' } }], 'en')).toEqual([{ ...link, label: 'Канал' }]);
  });

  it('keeps ratings on the current star scale', () => {
    expect(ratingOnScale(null, 5)).toBeNull();
    expect(ratingOnScale(4, 5)).toBe(4);
    expect(ratingOnScale(8, 5)).toBe(5);
    expect(ratingOnScale(8, 10)).toBe(8);
  });
});
