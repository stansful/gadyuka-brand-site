import { IntlMessageFormat, PrimitiveType } from 'intl-messageformat';

import { LOCALE_TAGS, Locale } from '~core/locales/locale.enum';

/** Formats an ICU message with its arguments (plain text: no rich-text tags). */
export class MessageFormatter {
  format(template: string, locale: Locale, values: Readonly<Record<string, PrimitiveType>> = {}): string {
    const result = new IntlMessageFormat(template, LOCALE_TAGS[locale]).format<string>({ ...values });
    return Array.isArray(result) ? result.join('') : String(result);
  }
}
