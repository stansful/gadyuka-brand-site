import { describe, expect, it } from 'vitest';

import { locales, type Locale } from '@/i18n/locales';
import { defaultMessage, isMessageKey, type MessageKey } from '@/i18n/messages';

import { adminTestTranslator } from '../../../test/admin-intl';
import { planSiteImageSave, planSiteTextSave, siteTextConflictFailure, type SiteTextChange } from './site-text-save';
import { siteTextLabels, type StoredMessage } from './site-texts';

const labels = siteTextLabels(adminTestTranslator('admin.siteTexts'));
const tErrors = adminTestTranslator('admin.siteTexts.errors');

function messageKey(key: string): MessageKey {
  if (!isMessageKey(key)) throw new Error(`messages/ru.json has no ${key}`);
  return key;
}

const TITLE = messageKey('hero.title');
const SLOGAN = messageKey('hero.slogan');
const EDITED_AT = new Date('2026-10-20T10:00:00.000Z');
const NOW = new Date('2026-10-21T12:00:00.000Z');

function row(key: MessageKey, locale: Locale, value: string, editedAt: Date | null = null): StoredMessage {
  return { key, locale, value, editedAt };
}

function defaultRows(...keys: MessageKey[]): StoredMessage[] {
  return keys.flatMap(key => locales.map(locale => row(key, locale, defaultMessage(key, locale))));
}

function change(key: MessageKey, locale: Locale, value: string, base: string): SiteTextChange {
  return { key, locale, value, base };
}

describe('planSiteTextSave (lost updates across tabs)', () => {
  const title = defaultMessage(TITLE, 'ru');
  const slogan = defaultMessage(SLOGAN, 'ru');

  it('refuses an edit whose row was changed elsewhere since the editor loaded it — nothing is written', () => {
    // Tab 2 saved «ГАДЮКА 2.0»; tab 1 still edits from the default.
    const rows = [...defaultRows(SLOGAN), row(TITLE, 'ru', 'ГАДЮКА 2.0', EDITED_AT)];
    const plan = planSiteTextSave(
      [change(SLOGAN, 'ru', 'Новый слоган', slogan), change(TITLE, 'ru', 'Моя правка', title)],
      rows,
      NOW,
    );
    expect(plan.conflicts).toEqual([{ key: TITLE, locale: 'ru', current: 'ГАДЮКА 2.0' }]);
    expect(plan.writes).toEqual([]);
  });

  it('writes an edit that still starts from the stored text', () => {
    const plan = planSiteTextSave([change(SLOGAN, 'ru', 'Новый слоган', slogan)], defaultRows(SLOGAN), NOW);
    expect(plan.conflicts).toEqual([]);
    expect(plan.writes).toEqual([{ key: SLOGAN, locale: 'ru', value: 'Новый слоган', editedAt: NOW }]);
    expect(plan.stored).toEqual({ [SLOGAN]: { ru: 'Новый слоган' } });
  });

  it('is no conflict when the row already holds the same edit (another tab saved the same text)', () => {
    const rows = [row(SLOGAN, 'ru', 'Новый слоган', EDITED_AT)];
    const plan = planSiteTextSave([change(SLOGAN, 'ru', 'Новый слоган', slogan)], rows, NOW);
    expect(plan).toEqual({ conflicts: [], writes: [], stored: { [SLOGAN]: { ru: 'Новый слоган' } } });
  });

  it('compares the edit with the default while the row is missing', () => {
    const fresh = planSiteTextSave([change(SLOGAN, 'en', 'Remember', defaultMessage(SLOGAN, 'en'))], [], NOW);
    expect(fresh.writes).toEqual([{ key: SLOGAN, locale: 'en', value: 'Remember', editedAt: NOW }]);
    const stale = planSiteTextSave([change(SLOGAN, 'en', 'Remember', 'An older default')], [], NOW);
    expect(stale.conflicts).toEqual([{ key: SLOGAN, locale: 'en', current: defaultMessage(SLOGAN, 'en') }]);
  });

  it('never writes a resent stored text over a row: it only creates a missing row, with the default', () => {
    const rows = [row(TITLE, 'ru', 'ГАДЮКА 2.0', EDITED_AT)];
    const plan = planSiteTextSave(
      [
        // Stale but untouched: the row keeps tab 2's text.
        change(TITLE, 'ru', title, title),
        // No row yet: created with the default (not with an outdated value the tab loaded).
        change(TITLE, 'en', 'An older default', 'An older default'),
      ],
      rows,
      NOW,
    );
    expect(plan.conflicts).toEqual([]);
    expect(plan.writes).toEqual([{ key: TITLE, locale: 'en', value: defaultMessage(TITLE, 'en'), editedAt: null }]);
    expect(plan.stored).toEqual({ [TITLE]: { ru: 'ГАДЮКА 2.0', en: defaultMessage(TITLE, 'en') } });
  });

  it('treats whitespace around the base as no edit (the schema trims only the value)', () => {
    const rows = [row(SLOGAN, 'ru', ` ${slogan} `)];
    expect(planSiteTextSave([change(SLOGAN, 'ru', slogan, ` ${slogan} `)], rows, NOW)).toEqual({
      conflicts: [],
      writes: [],
      stored: { [SLOGAN]: { ru: ` ${slogan} ` } },
    });
  });
});

describe('planSiteImageSave', () => {
  it('writes a picked image that replaces what is stored', () => {
    expect(
      planSiteImageSave([{ key: 'about.image', mediaId: 'm2', base: 'm1' }], [{ key: 'about.image', mediaId: 'm1' }]),
    ).toEqual({ conflicts: [], writes: [{ key: 'about.image', mediaId: 'm2' }] });
    expect(planSiteImageSave([{ key: 'about.image', mediaId: 'm2', base: null }], [])).toEqual({
      conflicts: [],
      writes: [{ key: 'about.image', mediaId: 'm2' }],
    });
  });

  it('refuses an image replaced elsewhere meanwhile, and skips unchanged ones', () => {
    const rows = [
      { key: 'about.image', mediaId: 'm3' },
      { key: 'tailoring.image', mediaId: 'm9' },
    ];
    expect(
      planSiteImageSave(
        [
          { key: 'about.image', mediaId: 'm2', base: 'm1' },
          { key: 'tailoring.image', mediaId: 'm1', base: 'm1' },
        ],
        rows,
      ),
    ).toEqual({ conflicts: ['about.image'], writes: [] });
    expect(planSiteImageSave([{ key: 'about.image', mediaId: 'm3', base: 'm1' }], rows)).toEqual({
      conflicts: [],
      writes: [],
    });
  });
});

describe('siteTextConflictFailure', () => {
  it('names the texts and images changed elsewhere and asks to reload; fields quote what is stored', () => {
    const failure = siteTextConflictFailure(
      [
        { key: TITLE, locale: 'ru', current: 'ГАДЮКА 2.0' },
        { key: SLOGAN, locale: 'en', current: '' },
      ],
      ['about.image'],
      labels,
      tErrors,
    );
    expect(failure.message).toContain(`«${labels.text(TITLE)}» (RU), «${labels.text(SLOGAN)}» (EN), картинку «Фото»`);
    expect(failure.message).toMatch(/^Ничего не сохранено/);
    expect(failure.message).toMatch(/обновите страницу/);
    expect(failure.fieldErrors).toEqual({
      [`${TITLE}.ru`]: expect.stringContaining('Сейчас сохранено: «ГАДЮКА 2.0»'),
      [`${SLOGAN}.en`]: expect.stringContaining('сейчас он пустой'),
      'about.image': expect.stringContaining('обновите страницу'),
    });
  });

  it('counts the texts beyond the first five', () => {
    const conflicts = Array.from({ length: 7 }, () => ({ key: TITLE, locale: 'ru' as const, current: 'x' }));
    expect(siteTextConflictFailure(conflicts, [], labels, tErrors).message).toContain('и ещё 2.');
  });
});
