import { Locale } from './locale.enum';

/** Records with one value per locale (`Record<Locale, T>` makes TypeScript require every locale). */
export class LocaleMap {
  static readonly LOCALES: readonly Locale[] = Object.values(Locale);

  static build<T>(valueFor: (locale: Locale) => T): Record<Locale, T> {
    const entries = LocaleMap.LOCALES.map(locale => [locale, valueFor(locale)] as const);
    // Every locale was assigned above.
    return Object.fromEntries(entries) as Record<Locale, T>;
  }

  static isLocale(value: unknown): value is Locale {
    return typeof value === 'string' && (LocaleMap.LOCALES as readonly string[]).includes(value);
  }
}
