import { defaultLocale, locales, type Locale } from "@/i18n/locales";
import type { FieldErrors } from "@/lib/admin/action-result";

/**
 * Server errors come as "blocks.<index>.value.<locale>" or "<key>" → re-key them by block key.
 * The suffix is matched against the configured locales (not a character class), so region
 * codes like "pt-br" or "zh-Hans" work too; an unknown suffix falls back to the block itself.
 */
export function errorsByBlockKey(fieldErrors: FieldErrors, keys: readonly string[]): FieldErrors {
  const out: FieldErrors = {};
  for (const [path, message] of Object.entries(fieldErrors)) {
    const match = /^blocks\.(\d+)\.(?:value|mediaId)(?:\.(.+))?$/.exec(path);
    if (match) {
      const key = keys[Number(match[1])];
      if (!key) continue;
      const locale = locales.find((candidate) => candidate === match[2]);
      out[locale ? `${key}.${locale}` : key] = message;
      continue;
    }
    out[path] = message;
  }
  return out;
}

export function errorLocales(errors: FieldErrors, keys: readonly string[]): Set<Locale> {
  const result = new Set<Locale>();
  for (const path of Object.keys(errors)) {
    const key = keys.find((candidate) => path === candidate || path.startsWith(`${candidate}.`));
    if (!key) continue;
    const suffix = path.slice(key.length + 1);
    result.add(locales.find((locale) => locale === suffix) ?? defaultLocale);
  }
  return result;
}
