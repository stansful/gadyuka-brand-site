import { describe, expect, it } from 'vitest';

import { missingLocales, parseLocalizedText, readText } from './localized-text';

describe('readText', () => {
  it('returns the requested locale', () => {
    expect(readText({ ru: 'Каталог', en: 'Catalog' }, 'en')).toBe('Catalog');
  });

  it('falls back to ru when the translation is missing or blank', () => {
    expect(readText({ ru: 'Каталог' }, 'en')).toBe('Каталог');
    expect(readText({ ru: 'Каталог', en: '   ' }, 'en')).toBe('Каталог');
  });

  it('can disable the fallback', () => {
    expect(readText({ ru: 'Каталог' }, 'en', { fallback: false })).toBe('');
  });

  it('tolerates malformed values', () => {
    expect(readText(null, 'ru')).toBe('');
    expect(readText('plain string', 'ru')).toBe('');
    expect(readText({ ru: 42, en: 'Catalog' }, 'ru')).toBe('');
    expect(readText({ ru: 42, en: 'Catalog' }, 'en')).toBe('Catalog');
  });
});

describe('parseLocalizedText', () => {
  it('drops unknown locales and non-string values', () => {
    expect(parseLocalizedText({ ru: 'а', de: 'b', en: 1 })).toEqual({ ru: 'а' });
  });

  it('turns anything but a plain object into an empty text', () => {
    expect(parseLocalizedText(null)).toEqual({});
    expect(parseLocalizedText(['ru'])).toEqual({});
    expect(parseLocalizedText(new Date())).toEqual({});
  });
});

describe('missingLocales', () => {
  it('reports the locales without their own translation', () => {
    expect(missingLocales({ ru: 'Да' })).toEqual(['en']);
    expect(missingLocales({ ru: 'Да', en: ' ' })).toEqual(['en']);
    expect(missingLocales({ ru: 'Да', en: 'Yes' })).toEqual([]);
  });
});
