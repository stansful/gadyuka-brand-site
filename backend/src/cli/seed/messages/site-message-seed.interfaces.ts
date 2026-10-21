import { Locale } from '~core/locales/locale.enum';

/** A Message row as the seed reads it. */
export interface StoredSiteMessage {
  readonly key: string;
  readonly locale: string;
  readonly value: string;
  /** null = the value came from the seed; set = edited in the admin */
  readonly editedAt: Date | null;
}

/** The default value of one site message key in one locale (shared/messages/<locale>.json). */
export interface SiteMessageDefault {
  readonly key: string;
  readonly locale: Locale;
  readonly value: string;
}

/** What one seed run writes to the Message rows. */
export interface SiteMessageSeedPlan {
  /** Missing rows: created with the default (editedAt = null) */
  readonly creates: readonly SiteMessageDefault[];
  /** Rows set to the default (a new default, or every differing / edited row with SEED_OVERWRITE=1) */
  readonly updates: readonly SiteMessageDefault[];
  /** Rows edited in the admin, left alone */
  readonly keptEdited: number;
  /** "<locale>:<key>" of rows whose key or locale is not in shared/messages (kept, unused by the site) */
  readonly orphans: readonly string[];
}
