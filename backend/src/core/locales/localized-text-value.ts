import type { LocalizedText } from '~shared/contracts/common';

import { LocaleMap } from './locale-map';
import { DEFAULT_LOCALE, Locale } from './locale.enum';

/** Translations as an admin form submits them (validated; a locale may be missing, empty or null). */
export type TranslationsInput = Readonly<Partial<Record<Locale, string | null>>>;

/**
 * LocalizedText — every translatable column ({ "ru": "Каталог", "en": "Catalog" }, JSON): what is
 * stored (`normalize`: trimmed, only filled translations) and how a stored value is read back
 * (`from` / `parse`: tolerant — anything but a plain object is empty, unknown locales and non-string
 * values are ignored instead of failing a page). Reading for one locale falls back to the default
 * locale (ru), like the site.
 */
export class LocalizedTextValue {
  /** Longest translation of ANY LocalizedText field, checked before trimming (protects the database). */
  static readonly MAX_TRANSLATION_LENGTH = 20_000;

  private constructor(private readonly translations: LocalizedText) {}

  /** A stored JSON value. Never throws. */
  static from(value: unknown): LocalizedTextValue {
    if (!LocalizedTextValue.isPlainObject(value)) {
      return new LocalizedTextValue({});
    }
    const known = Object.entries(value).filter(
      (entry): entry is [Locale, string] => LocaleMap.isLocale(entry[0]) && typeof entry[1] === 'string',
    );
    return new LocalizedTextValue(Object.fromEntries(known));
  }

  /** The translations of a stored JSON value (`from(value).toTranslations()`). */
  static parse(value: unknown): LocalizedText {
    return LocalizedTextValue.from(value).toTranslations();
  }

  /** What to store: `{ ru: " Худи ", en: "" }` → `{ ru: "Худи" }` (only the site's locales, in their order). */
  static normalize(input: TranslationsInput): LocalizedText {
    const entries = LocaleMap.LOCALES.flatMap(locale => {
      const text = input[locale];
      return typeof text === 'string' && text.trim() !== '' ? [[locale, text.trim()] as const] : [];
    });
    return Object.fromEntries(entries);
  }

  /** True when the trimmed text of `locale` is not empty. */
  static hasText(input: TranslationsInput, locale: Locale): boolean {
    return (input[locale] ?? '').trim() !== '';
  }

  toTranslations(): LocalizedText {
    return { ...this.translations };
  }

  /** The trimmed translation of `locale`, else of the default locale (ru), else "". */
  read(locale: Locale): string {
    return this.readOwn(locale) || this.readOwn(DEFAULT_LOCALE);
  }

  /** The trimmed translation of `locale` only: "" when it is missing (no fallback). */
  readOwn(locale: Locale): string {
    return this.translations[locale]?.trim() ?? '';
  }

  /** Like `read`, null instead of "" (optional parts of a page). */
  readOptional(locale: Locale): string | null {
    const text = this.read(locale);
    return text.length > 0 ? text : null;
  }

  /** The default-locale (ru) text, trimmed; "" when there is none. */
  defaultText(): string {
    return this.readOwn(DEFAULT_LOCALE);
  }

  /** True when no locale has a value at all (an empty string counts as a value: it was saved on purpose). */
  hasNoTranslation(): boolean {
    return Object.keys(this.translations).length === 0;
  }

  private static isPlainObject(value: unknown): value is Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return false;
    }
    const prototype: unknown = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }
}
