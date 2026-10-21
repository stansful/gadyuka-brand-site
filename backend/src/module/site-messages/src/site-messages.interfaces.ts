import { Locale } from '~core/locales/locale.enum';

/** One `Message` row as stored (key = dotted path of shared/messages/<locale>.json). */
export interface SiteMessageRow {
  readonly key: string;
  readonly locale: string;
  readonly value: string;
}

/** Source of the admin-edited Message rows. */
export interface ISiteMessageRows {
  /** Every row of the given locales (orphan keys included: the resolver ignores them). */
  findByLocales(locales: readonly Locale[]): Promise<SiteMessageRow[]>;
}
