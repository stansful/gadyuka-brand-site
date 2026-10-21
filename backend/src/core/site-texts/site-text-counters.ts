import { LocaleMap } from '~core/locales/locale-map';
import { DEFAULT_LOCALE, Locale } from '~core/locales/locale.enum';

/** What the counters read of a site text in the editor. */
export interface SiteTextState {
  readonly values: Readonly<Record<Locale, string>>;
  /** Locales edited in the admin (Message.editedAt set) */
  readonly edited: Readonly<Partial<Record<Locale, string>>>;
  /** Locales without a Message row */
  readonly missing: readonly Locale[];
}

/**
 * Counters of a set of site texts (a section tab, the dashboard card):
 * - edited: edited in the admin in any locale;
 * - gaps: the Russian text is filled in but a translation is empty — the site shows Russian there;
 * - unsaved: a locale has no row yet (the site shows the default).
 */
export class SiteTextCounters {
  private constructor(
    readonly total: number,
    readonly edited: number,
    readonly gaps: number,
    readonly unsaved: number,
  ) {}

  static of(states: readonly SiteTextState[]): SiteTextCounters {
    return new SiteTextCounters(
      states.length,
      states.filter(state => SiteTextCounters.isEdited(state)).length,
      states.filter(state => SiteTextCounters.hasTranslationGap(state)).length,
      states.filter(state => state.missing.length > 0).length,
    );
  }

  static isEdited(state: SiteTextState): boolean {
    return Object.keys(state.edited).length > 0;
  }

  static hasTranslationGap(state: SiteTextState): boolean {
    if (state.values[DEFAULT_LOCALE].trim() === '') {
      return false;
    }
    return LocaleMap.LOCALES.some(locale => locale !== DEFAULT_LOCALE && state.values[locale].trim() === '');
  }
}
