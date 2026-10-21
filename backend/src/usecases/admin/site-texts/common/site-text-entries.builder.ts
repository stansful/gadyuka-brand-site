import { Injectable } from '@nestjs/common';

import { LocaleMap } from '~core/locales/locale-map';
import { Locale } from '~core/locales/locale.enum';
import { SiteTextState } from '~core/site-texts/site-text-counters';
import { SiteTextRowIndex, StoredSiteText } from '~core/site-texts/site-text-row-index';

import { SiteTextDefinition, SiteTextDefinitions } from './site-text-definitions';

/** A site text as the editor shows it: what the site shows now, per locale. */
export interface SiteTextEntryState extends SiteTextState {
  readonly definition: SiteTextDefinition;
  /** The row value, or the default while the row is missing */
  readonly values: Readonly<Record<Locale, string>>;
  /** ISO 8601 Message.editedAt of the locales edited in the admin */
  readonly edited: Readonly<Partial<Record<Locale, string>>>;
  readonly missing: readonly Locale[];
}

/**
 * Every site text with its stored rows (port of the frontend's buildSiteTextEntries). The editor shows
 * what the site shows: the row value, or the shared/messages default while a row is missing;
 * Message.editedAt is the «изменено» marker (null = the default text). Rows of other keys and locales
 * are ignored.
 */
@Injectable()
export class SiteTextEntriesBuilder {
  constructor(private readonly definitions: SiteTextDefinitions) {}

  /** Every site text, in the order of shared/messages/ru.json. */
  build(rows: readonly StoredSiteText[]): SiteTextEntryState[] {
    const index = SiteTextRowIndex.of(rows);
    return this.definitions.all().map(definition => this.entryOf(definition, index));
  }

  private entryOf(definition: SiteTextDefinition, index: SiteTextRowIndex): SiteTextEntryState {
    const rows = LocaleMap.build(locale => index.find(definition.key, locale));
    return {
      definition,
      values: LocaleMap.build(locale => rows[locale]?.value ?? definition.defaults[locale]),
      edited: this.editedOf(rows),
      missing: LocaleMap.LOCALES.filter(locale => rows[locale] === undefined),
    };
  }

  private editedOf(rows: Readonly<Record<Locale, StoredSiteText | undefined>>): Partial<Record<Locale, string>> {
    return Object.fromEntries(
      LocaleMap.LOCALES.flatMap(locale => {
        const editedAt = rows[locale]?.editedAt;
        return editedAt ? [[locale, editedAt.toISOString()]] : [];
      }),
    );
  }
}
