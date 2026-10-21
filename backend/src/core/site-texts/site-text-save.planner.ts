import { LocaleMap } from '~core/locales/locale-map';
import { Locale } from '~core/locales/locale.enum';

import { SiteTextRowIndex, StoredSiteText } from './site-text-row-index';

/** The shared/messages defaults (MessageCatalog). */
export interface SiteTextDefaults {
  siteDefault(key: string, locale: Locale): string;
}

/** One language of a text: the value to store. */
export interface SiteTextValue {
  readonly key: string;
  readonly locale: Locale;
  readonly value: string;
}

/** One language of a text in the save: the trimmed value and the stored text the edit started from. */
export interface SiteTextChange extends SiteTextValue {
  readonly base: string;
}

/** One Message upsert: `editedAt` null = the value is the default. */
export interface SiteTextWrite extends SiteTextValue {
  readonly editedAt: Date | null;
}

/** A text changed elsewhere since the editor loaded it: what the row holds now. */
export interface SiteTextConflict {
  readonly key: string;
  readonly locale: Locale;
  readonly current: string;
}

/** key → locale → text. */
export type SiteTextValuesByKey = Record<string, Partial<Record<Locale, string>>>;

export interface SiteTextSavePlan {
  readonly conflicts: readonly SiteTextConflict[];
  readonly writes: readonly SiteTextWrite[];
  /** What every submitted text holds after the save (the editor shows it). */
  readonly stored: SiteTextValuesByKey;
}

/**
 * Optimistic concurrency of the «Тексты сайта» save (port of the frontend's planSiteTextSave /
 * planSiteTextWrites). The editor sends only what the owner changed (plus the languages without a row),
 * each with `base`: the stored text the edit started from. Against the rows read under the save's lock:
 * - an edit (value ≠ base) whose row now holds a third text — changed in another tab or session — is a
 *   conflict: the whole save is refused, so a stale tab never puts an older text back over a newer one;
 * - an edit whose row still holds `base` (or already holds the value) is written;
 * - an unchanged text (value = base, whitespace aside) is never written over a row: a missing row gets
 *   the default the site shows, an existing one is left as it is.
 * Writes store only what changes: a value equal to the locale's default gets editedAt = null («по
 * умолчанию»), any other value editedAt = now («изменено»); a row with the same value and the same
 * default / edited state is not touched.
 */
export class SiteTextSavePlanner {
  constructor(private readonly defaults: SiteTextDefaults) {}

  /** An edit, not a resend of the stored text (the value is trimmed already, the base is not). */
  static isEdit(change: Pick<SiteTextChange, 'value' | 'base'>): boolean {
    return change.value !== change.base.trim();
  }

  plan(changes: readonly SiteTextChange[], rows: readonly StoredSiteText[], now: Date): SiteTextSavePlan {
    const run = new SiteTextSaveRun(SiteTextRowIndex.of(rows), this.defaults);
    changes.forEach(change => run.add(change));
    const conflicts = run.conflicts();
    const writes = conflicts.length > 0 ? [] : this.writesOf(run.accepted(), rows, now);
    return { conflicts, writes, stored: run.stored() };
  }

  /** The Message writes that store `values`: only what actually changes. */
  writesOf(values: readonly SiteTextValue[], rows: readonly StoredSiteText[], now: Date): SiteTextWrite[] {
    const index = SiteTextRowIndex.of(rows);
    return values.filter(value => !this.isStoredAlready(value, index)).map(value => this.writeOf(value, now));
  }

  /** «Вернуть по умолчанию»: the default of every locale, editedAt = null. */
  resetWrites(key: string): SiteTextWrite[] {
    return LocaleMap.LOCALES.map(locale => ({
      key,
      locale,
      value: this.defaults.siteDefault(key, locale),
      editedAt: null,
    }));
  }

  private isStoredAlready(value: SiteTextValue, index: SiteTextRowIndex): boolean {
    const row = index.find(value.key, value.locale);
    return row !== undefined && row.value === value.value && (row.editedAt === null) === this.isDefault(value);
  }

  private writeOf(value: SiteTextValue, now: Date): SiteTextWrite {
    return { key: value.key, locale: value.locale, value: value.value, editedAt: this.isDefault(value) ? null : now };
  }

  private isDefault(value: SiteTextValue): boolean {
    return value.value === this.defaults.siteDefault(value.key, value.locale);
  }
}

/** One planning pass over the changes of a save (collects conflicts, accepted values and stored texts). */
class SiteTextSaveRun {
  private readonly conflictList: SiteTextConflict[] = [];
  private readonly acceptedList: SiteTextValue[] = [];
  private readonly storedValues: SiteTextValuesByKey = {};

  constructor(
    private readonly rows: SiteTextRowIndex,
    private readonly defaults: SiteTextDefaults,
  ) {}

  /** `current` = what the site shows now: the row, or the default while the row is missing. */
  add(change: SiteTextChange): void {
    const row = this.rows.find(change.key, change.locale);
    const current = row === undefined ? this.defaults.siteDefault(change.key, change.locale) : row.value;
    if (!SiteTextSavePlanner.isEdit(change)) {
      this.keepStored(change, current, row);
      return;
    }
    this.addEdit(change, current);
  }

  conflicts(): SiteTextConflict[] {
    return this.conflictList;
  }

  accepted(): SiteTextValue[] {
    return this.acceptedList;
  }

  stored(): SiteTextValuesByKey {
    return this.storedValues;
  }

  /** A resent stored text: a missing row is created with what the site shows, an existing one stays. */
  private keepStored(change: SiteTextChange, current: string, row: StoredSiteText | undefined): void {
    if (row === undefined) {
      this.acceptedList.push({ key: change.key, locale: change.locale, value: current });
    }
    this.remember(change.key, change.locale, current);
  }

  /** An edit of a text changed elsewhere meanwhile (a third text is stored) is a conflict. */
  private addEdit(change: SiteTextChange, current: string): void {
    if (current !== change.base && current !== change.value) {
      this.conflictList.push({ key: change.key, locale: change.locale, current });
      return;
    }
    this.accept({ key: change.key, locale: change.locale, value: change.value });
  }

  private accept(value: SiteTextValue): void {
    this.acceptedList.push(value);
    this.remember(value.key, value.locale, value.value);
  }

  private remember(key: string, locale: Locale, text: string): void {
    this.storedValues[key] = { ...this.storedValues[key], [locale]: text };
  }
}
