import { DEFAULT_LOCALE, Locale } from '~core/locales/locale.enum';
import { FlatMessages, MessageCatalog } from '~module/messages';

import { SiteMessageRow } from './site-messages.interfaces';

/** The rows of the requested locale and of the default locale, by key. */
interface LocaleRows {
  readonly own: ReadonlyMap<string, string>;
  readonly base: ReadonlyMap<string, string>;
}

/**
 * The value of every site message of a locale: Message rows over the shared/messages defaults
 * (port of the frontend's resolveMessageValues):
 * - no row → the default of that locale (a key added by a release before the seed ran);
 * - a non-blank row → the row;
 * - a blank row of the default locale (ru) → "" (emptied in the admin on purpose: the element hides);
 * - a blank row of another locale → the resolved default-locale value (an empty EN shows the
 *   Russian text; empty in both = hidden);
 * - rows whose key is not a message of ru.json (orphans of removed keys) are ignored.
 * Keys come in the order of ru.json.
 */
export class SiteMessageResolver {
  constructor(private readonly catalog: MessageCatalog) {}

  /** `rows` must hold the rows of `locale` and — for another locale — of the default locale. */
  resolve(locale: Locale, rows: readonly SiteMessageRow[]): FlatMessages {
    const localeRows: LocaleRows = { own: this.rowsOf(rows, locale), base: this.rowsOf(rows, DEFAULT_LOCALE) };
    return Object.fromEntries(this.catalog.siteKeys().map(key => [key, this.valueOf(key, locale, localeRows)]));
  }

  /** The locales whose rows `resolve(locale, …)` needs. */
  localesToRead(locale: Locale): Locale[] {
    return locale === DEFAULT_LOCALE ? [locale] : [locale, DEFAULT_LOCALE];
  }

  private valueOf(key: string, locale: Locale, rows: LocaleRows): string {
    const value = rows.own.get(key);
    if (value === undefined) {
      return this.catalog.siteDefault(key, locale);
    }
    if (value.trim() !== '') {
      return value;
    }
    return locale === DEFAULT_LOCALE ? '' : this.defaultLocaleValueOf(key, rows.base);
  }

  private defaultLocaleValueOf(key: string, base: ReadonlyMap<string, string>): string {
    const value = base.get(key);
    if (value === undefined) {
      return this.catalog.siteDefault(key, DEFAULT_LOCALE);
    }
    return value.trim() === '' ? '' : value;
  }

  private rowsOf(rows: readonly SiteMessageRow[], locale: Locale): Map<string, string> {
    return new Map(rows.filter(row => row.locale === locale).map(row => [row.key, row.value]));
  }
}
