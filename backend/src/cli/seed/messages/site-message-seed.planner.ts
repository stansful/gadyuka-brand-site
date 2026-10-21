import { Injectable } from '@nestjs/common';

import { LocaleMap } from '~core/locales/locale-map';
import { MessageCatalog } from '~module/messages';

import { SeedMode } from '../run/seed-mode.enum';
import { SiteMessageSeedPlanBuilder } from './site-message-seed-plan.builder';
import { SiteMessageDefault, SiteMessageSeedPlan, StoredSiteMessage } from './site-message-seed.interfaces';

/** What to do with an existing row of a known key (the mode decides). */
type ExistingRowPolicy = (
  row: StoredSiteMessage,
  expected: SiteMessageDefault,
  plan: SiteMessageSeedPlanBuilder,
) => void;

/**
 * Site UI messages: shared/messages/<locale>.json → Message rows, for every locale (port of the
 * frontend's prisma/seed/messages.ts):
 * - a missing row → created with the default (editedAt = null);
 * - a row from the seed (editedAt null) whose value differs → updated: a new default rolls out;
 * - a row edited in the admin (editedAt set) → left alone;
 * - SEED_OVERWRITE=1 → every differing or edited row of a known key is reset to the default;
 * - orphans (rows of keys no longer in the JSON, or of removed locales) are reported, never deleted.
 */
@Injectable()
export class SiteMessageSeedPlanner {
  private static readonly EXISTING_ROW: Readonly<Record<SeedMode, ExistingRowPolicy>> = {
    [SeedMode.KEEP_EDITS]: (row, expected, plan) => SiteMessageSeedPlanner.keepEdits(row, expected, plan),
    [SeedMode.OVERWRITE]: (row, expected, plan) => SiteMessageSeedPlanner.overwrite(row, expected, plan),
  };

  constructor(private readonly catalog: MessageCatalog) {}

  plan(rows: readonly StoredSiteMessage[], mode: SeedMode): SiteMessageSeedPlan {
    const rowsById = new Map(rows.map(row => [this.idOf(row), row]));
    const plan = new SiteMessageSeedPlanBuilder();
    for (const expected of this.defaults()) {
      this.planDefault({ expected, row: rowsById.get(this.idOf(expected)) }, plan, mode);
    }
    return plan.build(this.findOrphans(rows));
  }

  /** Every key of shared/messages/ru.json × every locale, with its default. */
  defaults(): SiteMessageDefault[] {
    return LocaleMap.LOCALES.flatMap(locale =>
      this.catalog.siteKeys().map(key => ({ key, locale, value: this.catalog.siteDefault(key, locale) })),
    );
  }

  /** Number of site message keys (per locale). */
  keyCount(): number {
    return this.catalog.siteKeys().length;
  }

  private planDefault(
    { expected, row }: { readonly expected: SiteMessageDefault; readonly row: StoredSiteMessage | undefined },
    plan: SiteMessageSeedPlanBuilder,
    mode: SeedMode,
  ): void {
    if (row === undefined) {
      plan.addCreate(expected);
      return;
    }
    SiteMessageSeedPlanner.EXISTING_ROW[mode](row, expected, plan);
  }

  private static keepEdits(
    row: StoredSiteMessage,
    expected: SiteMessageDefault,
    plan: SiteMessageSeedPlanBuilder,
  ): void {
    if (row.editedAt !== null) {
      plan.countKeptEdit();
      return;
    }
    if (row.value !== expected.value) {
      plan.addUpdate(expected);
    }
  }

  private static overwrite(
    row: StoredSiteMessage,
    expected: SiteMessageDefault,
    plan: SiteMessageSeedPlanBuilder,
  ): void {
    if (row.value !== expected.value || row.editedAt !== null) {
      plan.addUpdate(expected);
    }
  }

  private findOrphans(rows: readonly StoredSiteMessage[]): string[] {
    const orphans = rows.filter(row => !this.catalog.isSiteKey(row.key) || !LocaleMap.isLocale(row.locale));
    return [...new Set(orphans.map(row => `${row.locale}:${row.key}`))];
  }

  private idOf({ locale, key }: { readonly locale: string; readonly key: string }): string {
    return `${locale}\u0000${key}`;
  }
}
