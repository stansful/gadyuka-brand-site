import { Locale } from '~core/locales/locale.enum';

/** A Message row as the admin reads it (key = dotted path of shared/messages/<locale>.json). */
export interface StoredSiteText {
  readonly key: string;
  readonly locale: string;
  readonly value: string;
  /** null = the default text (seeded or reset), set = edited in the admin */
  readonly editedAt: Date | null;
}

/** Message rows by key and locale (rows of other keys / locales are simply never asked for). */
export class SiteTextRowIndex {
  private constructor(private readonly rows: ReadonlyMap<string, StoredSiteText>) {}

  static of(rows: readonly StoredSiteText[]): SiteTextRowIndex {
    return new SiteTextRowIndex(new Map(rows.map(row => [SiteTextRowIndex.idOf(row.key, row.locale), row])));
  }

  private static idOf(key: string, locale: string): string {
    return `${locale}\u0000${key}`;
  }

  find(key: string, locale: Locale): StoredSiteText | undefined {
    return this.rows.get(SiteTextRowIndex.idOf(key, locale));
  }
}
