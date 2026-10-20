import { defaultLocale, locales, type Locale } from '@/i18n/locales';
import type { FieldErrors } from '@/lib/admin/action-result';

/**
 * Field errors of the «Тексты сайта» save (saveSiteTexts) keyed by what the editor renders:
 * "<message key>.<locale>" for a text, "<image key>" for a landing image.
 *
 * The action reports its own checks that way already; zod shape errors come as
 * "entries.<index>.values.<locale>.value" / "images.<index>.mediaId" — indexes of the SENT
 * payload (only the changed texts and images), so `entryKeys` / `imageKeys` are the keys of
 * that save in payload order — and are re-keyed here. The locale segment is matched against
 * the configured locales (not a character class), so region codes like "pt-br" or "zh-Hans"
 * work too; an unknown one falls back to the text itself.
 */
export function errorsByEntryKey(
  fieldErrors: FieldErrors,
  entryKeys: readonly string[],
  imageKeys: readonly string[] = [],
): FieldErrors {
  const out: FieldErrors = {};
  for (const [path, message] of Object.entries(fieldErrors)) {
    const entry = /^entries\.(\d+)(?:\.(?:values|key))?(?:\.([^.]+)(?:\..+)?)?$/.exec(path);
    if (entry) {
      const key = entryKeys[Number(entry[1])];
      if (!key) continue;
      const locale = locales.find(candidate => candidate === entry[2]);
      out[locale ? `${key}.${locale}` : key] = message;
      continue;
    }
    const image = /^images\.(\d+)(?:\..+)?$/.exec(path);
    if (image) {
      const key = imageKeys[Number(image[1])];
      if (key) out[key] = message;
      continue;
    }
    out[path] = message;
  }
  return out;
}

/** Language tabs with an error ("<key>.en" → en; "<key>" alone → the default locale). */
export function errorLocales(errors: FieldErrors, keys: readonly string[]): Set<Locale> {
  const result = new Set<Locale>();
  for (const path of Object.keys(errors)) {
    const key = keys.find(candidate => path === candidate || path.startsWith(`${candidate}.`));
    if (!key) continue;
    const suffix = path.slice(key.length + 1);
    result.add(locales.find(locale => locale === suffix) ?? defaultLocale);
  }
  return result;
}
