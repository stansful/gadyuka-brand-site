import type { LocalizedText } from '~shared/contracts/common';

import { LocaleMap } from '~core/locales/locale-map';
import { DEFAULT_LOCALE, Locale } from '~core/locales/locale.enum';
import { FlatMessages } from '~module/messages';

import { SeedCopyMissingError } from './seed-copy-missing.error';

/**
 * Seed copy of the demo entities — shared/messages/content/<locale>.json (SEED-ONLY: the site never
 * reads it; the seed copies it into the entity rows, which the admin then edits). Texts are addressed
 * by their dotted path ("news.pop-up-v-krasnodare.title"); a missing text stops the seed.
 */
export class SeedCopy {
  constructor(private readonly texts: Readonly<Record<Locale, FlatMessages>>) {}

  /** One text in every locale, for a LocalizedText column. */
  localized(path: string): LocalizedText {
    return LocaleMap.build(locale => this.textOf(path, locale));
  }

  /** The default-locale text, for a single-language column (Review.author, Partner.name). */
  defaultText(path: string): string {
    return this.textOf(path, DEFAULT_LOCALE);
  }

  /** Every text of a locale, flat (for the checks of the copy). */
  textsOf(locale: Locale): FlatMessages {
    return this.texts[locale];
  }

  private textOf(path: string, locale: Locale): string {
    const text = this.texts[locale][path];
    if (text === undefined) {
      throw new SeedCopyMissingError(path, locale);
    }
    return text;
  }
}
