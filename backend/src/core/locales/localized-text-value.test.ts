import { deepStrictEqual, strictEqual } from 'node:assert';
import { describe, it } from 'node:test';

import { Locale } from './locale.enum';
import { LocalizedTextValue } from './localized-text-value';

describe('LocalizedTextValue', () => {
  describe('what is stored (normalize)', () => {
    it('keeps the filled translations trimmed, in locale order', () => {
      deepStrictEqual(LocalizedTextValue.normalize({ ru: ' Худи ', en: '' }), { ru: 'Худи' });
      deepStrictEqual(LocalizedTextValue.normalize({ en: 'Hoodie', ru: null }), { en: 'Hoodie' });
      deepStrictEqual(LocalizedTextValue.normalize({ en: '  ' }), {});
      deepStrictEqual(Object.keys(LocalizedTextValue.normalize({ en: 'Hoodie', ru: 'Худи' })), ['ru', 'en']);
      deepStrictEqual(LocalizedTextValue.normalize({}), {});
    });

    it('tells whether a locale has text', () => {
      strictEqual(LocalizedTextValue.hasText({ ru: ' x ' }, Locale.RU), true);
      strictEqual(LocalizedTextValue.hasText({ ru: ' ' }, Locale.RU), false);
      strictEqual(LocalizedTextValue.hasText({ ru: null }, Locale.RU), false);
      strictEqual(LocalizedTextValue.hasText({}, Locale.EN), false);
    });
  });

  describe('what is read back (from / parse)', () => {
    it('keeps the string translations of known locales only (an empty one too)', () => {
      deepStrictEqual(LocalizedTextValue.parse({ ru: 'Каталог', en: 'Catalog', de: 'Katalog', fr: 5 }), {
        ru: 'Каталог',
        en: 'Catalog',
      });
      deepStrictEqual(LocalizedTextValue.from({ ru: 7, en: 'x' }).toTranslations(), { en: 'x' });
      deepStrictEqual(LocalizedTextValue.parse({ ru: '' }), { ru: '' });
    });

    it('reads anything but a plain object as empty', () => {
      for (const value of [null, undefined, 'text', 42, ['ru'], new Date()]) {
        deepStrictEqual(LocalizedTextValue.parse(value), {}, String(value));
      }
    });

    it('reads the trimmed translation of the locale, else the Russian one, else ""', () => {
      strictEqual(LocalizedTextValue.from({ ru: ' Каталог ', en: ' Catalog ' }).read(Locale.EN), 'Catalog');
      strictEqual(LocalizedTextValue.from({ ru: 'Каталог', en: '   ' }).read(Locale.EN), 'Каталог');
      strictEqual(LocalizedTextValue.from({ en: 'Catalog' }).read(Locale.RU), '');
      strictEqual(LocalizedTextValue.from({ ru: 7, de: 'Katalog', en: 'Catalog' }).read(Locale.EN), 'Catalog');
    });

    it('has no fallback for readOwn and defaultText (the alt text of a picture, a usage title)', () => {
      strictEqual(LocalizedTextValue.from({ ru: 'Пальто' }).readOwn(Locale.EN), '');
      strictEqual(LocalizedTextValue.from({ ru: 'Пальто', en: ' Coat ' }).readOwn(Locale.EN), 'Coat');
      strictEqual(LocalizedTextValue.from({ ru: '  Коллекция ', en: 'Collection' }).defaultText(), 'Коллекция');
      strictEqual(LocalizedTextValue.from({ en: 'Collection' }).defaultText(), '');
    });

    it('answers null instead of "" for readOptional (a social link without its own label)', () => {
      strictEqual(LocalizedTextValue.from({}).readOptional(Locale.RU), null);
      strictEqual(LocalizedTextValue.from({ ru: '  ' }).readOptional(Locale.EN), null);
      strictEqual(LocalizedTextValue.from({ ru: 'Канал' }).readOptional(Locale.EN), 'Канал');
    });

    it('has no translation only when no known locale has a string (empty alt text = the seed may set it)', () => {
      for (const value of [{}, null, undefined, 'alt', ['ru'], 42, { de: 'Alt' }, { ru: 5 }]) {
        strictEqual(LocalizedTextValue.from(value).hasNoTranslation(), true, JSON.stringify(value));
      }
      for (const value of [{ ru: 'Худи' }, { en: 'Hoodie' }, { ru: '' }, { de: 'x', en: 'Hoodie' }]) {
        strictEqual(LocalizedTextValue.from(value).hasNoTranslation(), false, JSON.stringify(value));
      }
    });
  });
});
