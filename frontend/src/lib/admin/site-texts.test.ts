import { describe, expect, it } from 'vitest';

import { defaultLocale, locales, type Locale } from '@/i18n/locales';
import { defaultMessageFormat } from '@/i18n/message-format';
import { MESSAGE_KEYS, defaultMessage, type MessageKey } from '@/i18n/messages';
import { CONTENT_SECTIONS, isRequiredKey } from '@/lib/content/registry';

import { adminTestTranslator } from '../../../test/admin-intl';
import {
  buildSiteTextEntries,
  hasTranslationGap,
  matchesSiteTextQuery,
  normalizeSiteTextQuery,
  planSiteTextWrites,
  resetSiteTextWrites,
  siteImageKeysOf,
  siteTextErrorMessage,
  siteTextLabels,
  siteTextSectionAnchor,
  siteTextSections,
  siteTextValueError,
  summarizeSiteTextSections,
  type StoredMessage,
} from './site-texts';

const labels = siteTextLabels(adminTestTranslator('admin.siteTexts'));
const tErrors = adminTestTranslator('admin.siteTexts.errors');

/** The message the admin shows for a value, or null when it can be saved. */
function valueError(key: MessageKey, locale: Locale, value: string): string | null {
  const error = siteTextValueError(key, locale, value);
  return error ? siteTextErrorMessage(error, tErrors) : null;
}

// Keys are picked from messages/ru.json by property, so the tests follow copy changes.
function firstKey(predicate: (key: MessageKey) => boolean, what: string): MessageKey {
  const key = MESSAGE_KEYS.find(predicate);
  if (!key) throw new Error(`messages/ru.json has no ${what}`);
  return key;
}

const plainKey = firstKey(
  key => defaultMessageFormat(key).arguments.length === 0 && defaultMessage(key, defaultLocale).length > 3,
  'plain text',
);
const argumentKey = firstKey(key => defaultMessageFormat(key).arguments.length > 0, 'text with an {argument}');
const requiredKey = firstKey(isRequiredKey, 'required text');
const optionalKey = firstKey(
  key => !isRequiredKey(key) && defaultMessageFormat(key).arguments.length === 0,
  'optional',
);
const EDITED_AT = new Date('2026-10-20T10:00:00.000Z');
const NOW = new Date('2026-10-21T12:00:00.000Z');

function row(key: MessageKey, locale: string, value: string, editedAt: Date | null = null): StoredMessage {
  return { key, locale, value, editedAt };
}

function defaultRows(key: MessageKey): StoredMessage[] {
  return locales.map(locale => row(key, locale, defaultMessage(key, locale)));
}

describe('sections', () => {
  it('lists the registry sections in registry order, then unknown namespaces by id', () => {
    const sections = siteTextSections([...MESSAGE_KEYS, 'zzzNew.title' as MessageKey], labels);
    const registryIds = CONTENT_SECTIONS.map(section => section.id).filter(id =>
      MESSAGE_KEYS.some(key => key.startsWith(`${id}.`)),
    );
    expect(sections.map(section => section.id)).toEqual([...registryIds, 'zzzNew']);
    expect(sections.at(-1)).toEqual({ id: 'zzzNew', label: 'zzzNew' });
    expect(sections.find(section => section.id === 'hero')?.label).toMatch(/[А-Яа-я]/);
  });

  it('names sections, texts and images from admin.siteTexts (key fallback for unlabeled texts)', () => {
    expect(labels.section('about')).toBe('О нас');
    expect(labels.section('zzzNew')).toBe('zzzNew');
    expect(labels.text('about.advantages.0.title')).toBe('Преимущество 1: заголовок');
    // ICU-escaped in the JSON: the label shows the placeholder literally.
    expect(labels.text('catalog.collectionTitle')).toBe('Название коллекции в кавычках ({title} — название)');
    expect(labels.text('zzzNew.some.key' as MessageKey)).toBe('some.key');
    expect(labels.image('about.image')).toBe('Фото');
  });

  it('never lists the admin namespace', () => {
    expect(siteTextSections(['admin.title' as MessageKey], labels).map(section => section.id)).toEqual([]);
  });

  it('knows landing anchors and images of a section', () => {
    expect(siteTextSectionAnchor('hero')).toBe('home');
    expect(siteTextSectionAnchor('forms')).toBeNull();
    expect(siteTextSectionAnchor('toString')).toBeNull();
    expect(siteImageKeysOf('about')).toEqual(['about.image']);
    expect(siteImageKeysOf('hero')).toEqual([]);
  });
});

describe('buildSiteTextEntries', () => {
  it('shows the defaults while rows are missing', () => {
    const [entry] = buildSiteTextEntries([plainKey], [], labels);
    expect(entry?.values[defaultLocale]).toBe(defaultMessage(plainKey, defaultLocale));
    expect(entry?.missing).toEqual([...locales]);
    expect(entry?.edited).toEqual({});
    expect(entry?.label).not.toBe('');
  });

  it('shows stored values and marks edited locales', () => {
    const [entry] = buildSiteTextEntries(
      [plainKey],
      [row(plainKey, 'ru', 'Новый текст', EDITED_AT), row(plainKey, 'en', defaultMessage(plainKey, 'en'))],
      labels,
    );
    expect(entry?.values.ru).toBe('Новый текст');
    expect(entry?.edited).toEqual({ ru: EDITED_AT.toISOString() });
    expect(entry?.missing).toEqual([]);
  });

  it('lists the {arguments} of the default', () => {
    const [entry] = buildSiteTextEntries([argumentKey], [], labels);
    expect(entry?.placeholders.length).toBeGreaterThan(0);
    expect(entry?.kind).toBe('icu');
  });
});

describe('gaps and counters', () => {
  it('counts an empty translation of a filled Russian text as a gap', () => {
    const values = { ru: 'Текст', en: '' };
    expect(hasTranslationGap({ values })).toBe(true);
    expect(hasTranslationGap({ values: { ru: '', en: '' } })).toBe(false);
    expect(hasTranslationGap({ values: { ru: 'Текст', en: 'Text' } })).toBe(false);
  });

  it('summarizes edited, untranslated and unsaved texts per section', () => {
    const sections = siteTextSections(MESSAGE_KEYS, labels);
    const entries = buildSiteTextEntries(
      MESSAGE_KEYS,
      [
        ...MESSAGE_KEYS.flatMap(defaultRows),
        // Overrides the default rows above (last row of a key/locale wins).
        row(plainKey, 'ru', 'Другой текст', EDITED_AT),
        row(plainKey, 'en', '', EDITED_AT),
      ],
      labels,
    );
    const summary = summarizeSiteTextSections(sections, entries);
    const section = summary.find(item => item.id === plainKey.split('.')[0]);
    expect(section).toMatchObject({ edited: 1, gaps: 1, unsaved: 0 });
    expect(summary.reduce((sum, item) => sum + item.total, 0)).toBe(MESSAGE_KEYS.length);
  });
});

describe('search', () => {
  const [entry] = buildSiteTextEntries([plainKey], [row(plainKey, 'ru', 'Ёжик в тумане', EDITED_AT)], labels);

  it('matches key, label, value and default, case- and ё-insensitively', () => {
    if (!entry) throw new Error('no entry');
    expect(matchesSiteTextQuery(entry, plainKey.toUpperCase())).toBe(true);
    expect(matchesSiteTextQuery(entry, entry.label)).toBe(true);
    expect(matchesSiteTextQuery(entry, 'ежик')).toBe(true);
    expect(matchesSiteTextQuery(entry, defaultMessage(plainKey, 'en').slice(0, 4))).toBe(true);
    expect(matchesSiteTextQuery(entry, 'совсем-не-найдётся-42')).toBe(false);
  });

  it('normalizes the query', () => {
    expect(normalizeSiteTextQuery('  два   слова ')).toBe('два слова');
    expect(normalizeSiteTextQuery(undefined)).toBe('');
    expect(normalizeSiteTextQuery('x'.repeat(500))).toHaveLength(100);
  });
});

describe('siteTextValueError', () => {
  it('accepts every default value', () => {
    for (const key of MESSAGE_KEYS) {
      for (const locale of locales) {
        expect({ key, locale, error: siteTextValueError(key, locale, defaultMessage(key, locale)) }).toEqual({
          key,
          locale,
          error: null,
        });
      }
    }
  });

  it('requires the Russian text of required keys only', () => {
    expect(siteTextValueError(requiredKey, 'ru', '  ')).toEqual({ key: 'required' });
    expect(valueError(requiredKey, 'ru', '  ')).toMatch(/^Обязательный текст/);
    expect(siteTextValueError(requiredKey, 'en', '')).toBeNull();
    expect(siteTextValueError(optionalKey, 'ru', '')).toBeNull();
  });

  it('rejects broken ICU syntax and unknown {arguments} / <tags>', () => {
    expect(valueError(argumentKey, 'ru', 'Текст {')).toMatch(/\{/);
    expect(valueError(plainKey, 'ru', 'Текст {name}')).toMatch(/нет подстановок — уберите \{name\}/);
    expect(valueError(plainKey, 'ru', 'Текст <b>жирно</b>')).toMatch(/<b>/);
  });

  it('requires the only accessible name of a control and the lead form errors', () => {
    for (const key of ['common.openMenu', 'common.homeLink', 'common.closeViewer', 'forms.sendAnother'] as const) {
      expect(siteTextValueError(key, 'ru', ''), key).toEqual({ key: 'required' });
    }
    expect(siteTextValueError('forms.errors.tooShort', 'ru', ' ')).toEqual({ key: 'required' });
    expect(siteTextValueError('forms.errors.invalidEmail', 'en', '')).toBeNull(); // shows the Russian text
  });

  it('keeps the texts the client fills in to plain {placeholders} (no raw ICU on the site)', () => {
    const plural = 'Слишком коротко — минимум {min, plural, one {# символ} few {# символа} other {# символов}}';
    expect(siteTextValueError('forms.errors.tooShort', 'ru', plural)).toEqual({
      key: 'templateFormat',
      values: { token: '{min}' },
    });
    expect(valueError('forms.errors.tooShort', 'ru', plural)).toMatch(/множественного числа.*\{min\}/);
    expect(valueError('gallery.counter', 'ru', '{current} из {total, number}')).toContain('{total}');
    expect(valueError('common.switchLanguageTo', 'ru', 'Язык: <lang>{ language }</lang>')).toContain(
      '<lang>{language}</lang>',
    );
    expect(valueError('contacts.form.subjectLine', 'en', 'Re: {subject} ({subject})')).toMatch(/\{subject\}.*один раз/);
    expect(valueError('forms.errors.tooLong', 'ru', "Max {max} — that''s it")).toMatch(/^Апострофы/);
    // the same plural is fine where the server formats the text (next-intl t())
    expect(siteTextValueError('catalog.models', 'ru', '{count, plural, one {# вещь} other {# вещей}}')).toBeNull();
  });

  it('rejects a format the site cannot render (next-intl would show the key instead)', () => {
    expect(valueError('catalog.models', 'ru', '{count, number, ::currency/XY}')).toContain(
      '{count, number, ::currency/XY}',
    );
    expect(siteTextValueError('catalog.models', 'en', '{count, number, ::currency/USD}')).toBeNull();
  });

  it('rejects a text that lost an {argument} of its default («из {max}» cannot become «из 5»)', () => {
    const simpleArgument = /\{(\w+)\}/;
    const key = firstKey(key => simpleArgument.test(defaultMessage(key, 'ru')), 'text with a plain {argument}');
    const lost = simpleArgument.exec(defaultMessage(key, 'ru'))?.[1] ?? '';
    const withoutArgument = defaultMessage(key, 'ru').replaceAll(`{${lost}}`, '5');
    expect(valueError(key, 'ru', withoutArgument)).toContain(`{${lost}}`);
    expect(siteTextValueError(key, 'ru', `${defaultMessage(key, 'ru')} — и ещё`)).toBeNull();
  });
});

describe('planSiteTextWrites', () => {
  const en = defaultMessage(plainKey, 'en');
  const ru = defaultMessage(plainKey, 'ru');

  it('writes nothing for untouched defaults', () => {
    expect(planSiteTextWrites([{ key: plainKey, values: { ru, en } }], defaultRows(plainKey), NOW)).toEqual([]);
  });

  it('marks a changed value as edited and keeps an unchanged edit as is', () => {
    const rows = [row(plainKey, 'ru', 'Правка', EDITED_AT), row(plainKey, 'en', en)];
    expect(planSiteTextWrites([{ key: plainKey, values: { ru: 'Правка', en: 'Edit' } }], rows, NOW)).toEqual([
      { key: plainKey, locale: 'en', value: 'Edit', editedAt: NOW },
    ]);
  });

  it('stores a value equal to the default as «по умолчанию» (editedAt = null)', () => {
    const rows = [row(plainKey, 'ru', 'Правка', EDITED_AT), row(plainKey, 'en', en)];
    expect(planSiteTextWrites([{ key: plainKey, values: { ru } }], rows, NOW)).toEqual([
      { key: plainKey, locale: 'ru', value: ru, editedAt: null },
    ]);
  });

  it('creates missing rows and skips locales that were not submitted', () => {
    expect(planSiteTextWrites([{ key: plainKey, values: { ru } }], [], NOW)).toEqual([
      { key: plainKey, locale: 'ru', value: ru, editedAt: null },
    ]);
  });

  it('stores an emptied translation as an edit', () => {
    expect(planSiteTextWrites([{ key: plainKey, values: { en: '' } }], defaultRows(plainKey), NOW)).toEqual(
      en === '' ? [] : [{ key: plainKey, locale: 'en', value: '', editedAt: NOW }],
    );
  });

  it('resets every locale to its default', () => {
    expect(resetSiteTextWrites(plainKey)).toEqual(
      locales.map(locale => ({ key: plainKey, locale, value: defaultMessage(plainKey, locale), editedAt: null })),
    );
  });
});
