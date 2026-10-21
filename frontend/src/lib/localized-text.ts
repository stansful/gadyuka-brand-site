import { defaultLocale, isLocale, locales, type Locale } from '@/i18n/locales';

/**
 * LocalizedText — the shape of every translatable field the backend sends and receives
 * (`LocalizedText` of shared/contracts/common.ts):
 *   { "ru": "Каталог", "en": "Catalog" }
 * Missing / empty translations fall back to the default locale (ru) on read.
 *
 * ISOMORPHIC and dependency-free: the type and the read-side helpers the admin uses for its own
 * views (list titles, «нужен перевод» badges, the media dialogs parsing route responses). Writing
 * rules (trimming, required Russian text, length limits) are the backend's.
 */
export type LocalizedText = Partial<Record<Locale, string>>;

/** A plain object (a JSON object from an API), not an array, a Date or a class instance. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * Parse an untrusted JSON value into LocalizedText. Never throws; invalid input → {}.
 * Tolerant: unknown keys (e.g. a removed language) and non-string values are ignored instead of
 * failing the whole page.
 */
export function parseLocalizedText(value: unknown): LocalizedText {
  if (!isPlainObject(value)) return {};
  const out: LocalizedText = {};
  for (const [key, text] of Object.entries(value)) {
    if (isLocale(key) && typeof text === 'string') out[key] = text;
  }
  return out;
}

export type ReadTextOptions = {
  /** Fall back to the default locale (ru) when the requested translation is empty. Default: true. */
  fallback?: boolean;
};

/**
 * Localized string for `locale` from a raw JSON value or LocalizedText.
 * Falls back to ru (unless `fallback: false`), returns "" when nothing is available.
 */
export function readText(value: unknown, locale: Locale, options: ReadTextOptions = {}): string {
  const text = parseLocalizedText(value);
  const own = text[locale]?.trim();
  if (own) return own;
  if (options.fallback === false) return '';
  return text[defaultLocale]?.trim() ?? '';
}

/** Locales that have no translation yet (for "needs translation" badges in the admin). */
export function missingLocales(value: unknown): Locale[] {
  return locales.filter(locale => readText(value, locale, { fallback: false }).length === 0);
}
