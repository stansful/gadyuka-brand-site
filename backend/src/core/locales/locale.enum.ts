/**
 * Site languages. Adding one: a value here + its entry in LOCALE_TAGS, shared/messages/<code>.json
 * (same keys as ru.json) and shared/messages/content/<code>.json; LocalizedText fields are JSON,
 * so no migration is needed.
 */
export enum Locale {
  RU = 'ru',
  EN = 'en',
}

export const DEFAULT_LOCALE = Locale.RU;

/** BCP-47 tags for Intl formatting. */
export const LOCALE_TAGS: Readonly<Record<Locale, string>> = {
  [Locale.RU]: 'ru-RU',
  [Locale.EN]: 'en-US',
};
