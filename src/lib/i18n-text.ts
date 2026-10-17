import { z } from "zod";
import { defaultLocale, isLocale, locales, type Locale } from "@/i18n/locales";

/**
 * LocalizedText — the shape of every translatable DB field (Prisma `Json`):
 *   { "ru": "Каталог", "en": "Catalog" }
 * Missing / empty translations fall back to the default locale (ru) on read.
 * Isomorphic (no server-only imports) so the admin client components can use it too.
 */
export type LocalizedText = Partial<Record<Locale, string>>;

/** Max length of a single translation (protects the DB from huge payloads). */
export const LOCALIZED_TEXT_MAX_LENGTH = 20_000;

const translationSchema = z.string().max(LOCALIZED_TEXT_MAX_LENGTH);

/**
 * Write-side schema (admin forms, server actions): only known locales, trimmed strings.
 * Empty strings are dropped, so `{ ru: "x", en: "" }` is stored as `{ ru: "x" }`.
 */
export const localizedTextSchema = z
  .partialRecord(z.enum(locales), translationSchema.trim())
  .transform((value): LocalizedText => {
    const out: LocalizedText = {};
    for (const locale of locales) {
      const text = value[locale];
      if (text !== undefined && text.length > 0) out[locale] = text;
    }
    return out;
  });

/** Like localizedTextSchema, but the default locale (ru) must be filled in. */
export const requiredLocalizedTextSchema = localizedTextSchema.refine(
  (value) => (value[defaultLocale] ?? "").length > 0,
  { message: `Заполните текст на языке по умолчанию (${defaultLocale})` },
);

/**
 * Read-side schema: tolerant — unknown keys (e.g. a removed language) and
 * non-string values are ignored instead of failing the whole page.
 */
const storedLocalizedTextSchema = z.record(z.string(), z.unknown());

/** Parse a raw Prisma Json value into LocalizedText. Never throws; invalid input → {}. */
export function parseLocalizedText(value: unknown): LocalizedText {
  if (value === null || value === undefined) return {};
  const parsed = storedLocalizedTextSchema.safeParse(value);
  if (!parsed.success) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[i18n-text] Ignoring malformed LocalizedText value:", value);
    }
    return {};
  }
  const out: LocalizedText = {};
  for (const [key, text] of Object.entries(parsed.data)) {
    if (isLocale(key) && typeof text === "string") out[key] = text;
  }
  return out;
}

export type ReadTextOptions = {
  /** Fall back to the default locale (ru) when the requested translation is empty. Default: true. */
  fallback?: boolean;
};

/**
 * Localized string for `locale` from a raw Json value or LocalizedText.
 * Falls back to ru (unless `fallback: false`), returns "" when nothing is available.
 */
export function readText(value: unknown, locale: Locale, options: ReadTextOptions = {}): string {
  const text = parseLocalizedText(value);
  const own = text[locale]?.trim();
  if (own) return own;
  if (options.fallback === false) return "";
  return text[defaultLocale]?.trim() ?? "";
}

/** Same as readText but returns null instead of "" (handy for optional UI parts). */
export function readOptionalText(value: unknown, locale: Locale): string | null {
  const text = readText(value, locale);
  return text.length > 0 ? text : null;
}

/** True when `locale` has its own non-empty translation (no fallback). */
export function hasTranslation(value: unknown, locale: Locale): boolean {
  return readText(value, locale, { fallback: false }).length > 0;
}

/** Locales that have no translation yet (for "needs translation" badges in the admin). */
export function missingLocales(value: unknown): Locale[] {
  return locales.filter((locale) => !hasTranslation(value, locale));
}

/** Build a LocalizedText, dropping empty values: lt({ ru: "Каталог", en: "Catalog" }). */
export function lt(values: LocalizedText): LocalizedText {
  const out: LocalizedText = {};
  for (const locale of locales) {
    const text = values[locale]?.trim();
    if (text) out[locale] = text;
  }
  return out;
}

/** Same text for every locale (brand names, URLs, phone numbers). */
export function sameForAllLocales(text: string): LocalizedText {
  const out: LocalizedText = {};
  for (const locale of locales) out[locale] = text;
  return out;
}

export const emptyLocalizedText = (): LocalizedText => ({});
