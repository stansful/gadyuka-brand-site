/**
 * Single source of truth for site languages. Adding a language (no DB migration is needed —
 * LocalizedText is JSON) touches these places; TypeScript flags every one of them that is
 * missing (they are Record<Locale, …>):
 *   1. `locales` below + its entries in `localeNames` and `localeTags`;
 *   2. messages/<code>.json (same shape as ru.json) + its loader in src/i18n/request.ts;
 *   3. `BRAND.displayName` / `BRAND.slogan` / `BRAND.city` in src/lib/seo/brand.ts (titles, JSON-LD);
 *   4. translations of all content in the admin (language tabs appear automatically).
 * Region-tagged codes ("pt-br") are supported by the admin error mapping
 * (src/components/admin/forms/content-errors.ts).
 */
export const locales = ["ru", "en"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "ru";

/** Human-readable names (used by the language switcher and the admin language tabs). */
export const localeNames: Readonly<Record<Locale, { short: string; native: string; ru: string }>> = {
  ru: { short: "RU", native: "Русский", ru: "Русский" },
  en: { short: "EN", native: "English", ru: "Английский" },
};

/** BCP-47 tags for <html lang>, Intl formatting and hreflang. */
export const localeTags: Readonly<Record<Locale, string>> = {
  ru: "ru-RU",
  en: "en-US",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (locales as ReadonlyArray<string>).includes(value);
}

/** Narrow an arbitrary value to a supported locale, falling back to the default one. */
export function toLocale(value: unknown): Locale {
  return isLocale(value) ? value : defaultLocale;
}
