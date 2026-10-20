import { describe, expect, it } from 'vitest';

import { locales } from '@/i18n/locales';

import en from '../../messages/en.json';
import ru from '../../messages/ru.json';
import { missingLocales, readOptionalText, readText } from './i18n-text';

/** Localization fallbacks the lead forms / SEO rely on (content in ru, en may be missing). */
describe('LocalizedText fallback to ru', () => {
  const seoTitle = { ru: 'ГАДЮКА — авторская уличная одежда' };

  it('serves ru content on the en site until the translation is filled in', () => {
    expect(readText(seoTitle, 'en')).toBe('ГАДЮКА — авторская уличная одежда');
    expect(missingLocales(seoTitle)).toEqual(['en']);
  });

  it('prefers the own translation and ignores blank ones', () => {
    expect(readText({ ru: 'Отправить', en: 'Send' }, 'en')).toBe('Send');
    expect(readText({ ru: 'Отправить', en: ' \n ' }, 'en')).toBe('Отправить');
  });

  it('returns empty values when nothing is filled in (form labels then use messages)', () => {
    expect(readText({}, 'en')).toBe('');
    expect(readOptionalText({ en: '' }, 'ru')).toBeNull();
    expect(readText(undefined, 'ru')).toBe('');
  });
});

describe('messages for lead forms', () => {
  type Tree = { [key: string]: string | Tree };
  const keysOf = (tree: Tree, prefix = ''): string[] =>
    Object.entries(tree).flatMap(([key, value]) =>
      typeof value === 'string' ? [`${prefix}${key}`] : keysOf(value, `${prefix}${key}.`),
    );

  it('has the same keys in every locale', () => {
    expect(locales).toEqual(['ru', 'en']);
    expect(keysOf(en).sort()).toEqual(keysOf(ru).sort());
  });

  it('has every lead error code', () => {
    for (const code of [
      'required',
      'invalidEmail',
      'invalidPhone',
      'contactRequired',
      'tooShort',
      'tooLong',
      'consentRequired',
      'invalidType',
      'invalid',
      'invalidForm',
      'rateLimited',
      'server',
      'network',
      'badRequest',
      'payloadTooLarge',
      'unsupportedMediaType',
    ]) {
      expect(ru.forms.errors).toHaveProperty(code);
      expect(en.forms.errors).toHaveProperty(code);
    }
    expect(ru.forms.errors.tooShort).toContain('{min}');
    expect(en.forms.errors.tooLong).toContain('{max}');
  });
});
