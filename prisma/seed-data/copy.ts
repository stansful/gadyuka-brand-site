import type { LocalizedText } from '../../src/lib/i18n-text';

import contentEn from '../../messages/content/en.json';
import contentRu from '../../messages/content/ru.json';
import { defaultLocale, mapLocales, type Locale } from '../../src/i18n/locales';

/**
 * Seed copy of the demo entities — messages/content/<locale>.json (SEED-ONLY: never loaded by
 * the site at runtime; the seed copies it into the entity rows, which the admin then edits).
 * The TypeScript modules next to this file keep only non-text data (slugs, ids, image keys,
 * dates, ratings) and look their texts up here, for every locale of src/i18n/locales.ts.
 *
 * Single-language DB columns (Review.author, Partner.name, User.name) take the value of the
 * default locale; the other files carry a translation of them too, so every file has the same
 * keys (checked by prisma/seed-data/content.test.ts).
 */

/** Shape of messages/content/ru.json — every locale file has the same shape. */
export type SeedCopy = typeof contentRu;

/** `Record<Locale, …>`: TypeScript requires a content file for every locale. */
export const SEED_COPY: Readonly<Record<Locale, SeedCopy>> = { ru: contentRu, en: contentEn };

/** One text in every locale, for a LocalizedText column: localized(copy => copy.news[slug].title). */
export function localized(pick: (copy: SeedCopy) => string): LocalizedText {
  return mapLocales(locale => pick(SEED_COPY[locale]));
}

/** The default-locale text, for a single-language column (Review.author, Partner.name). */
export function defaultCopy(pick: (copy: SeedCopy) => string): string {
  return pick(SEED_COPY[defaultLocale]);
}
