import { Injectable, Logger } from '@nestjs/common';

import { LocaleMap } from '~core/locales/locale-map';

import { SeedMode } from '../run/seed-mode.enum';
import { SeedOptions } from '../run/seed-options';
import { SeedStep } from '../seed-step.interface';
import { SiteMessageDefault, SiteMessageSeedPlan } from './site-message-seed.interfaces';
import { SiteMessageSeedPlanner } from './site-message-seed.planner';
import { SiteMessageSeedRepository } from './site-message-seed.repository';

/**
 * Site UI messages (shared/messages/<locale>.json → Message rows; rules: SiteMessageSeedPlanner). The
 * running server picks the new rows up when its SiteMessagesService cache expires (≤ 5 minutes).
 */
@Injectable()
export class SiteMessagesSeed implements SeedStep {
  /** How many orphan keys the log lists by name. */
  private static readonly ORPHANS_LISTED = 10;

  private readonly logger = new Logger(SiteMessagesSeed.name);
  private readonly writeUpdates: Readonly<Record<SeedMode, (values: readonly SiteMessageDefault[]) => Promise<void>>>;

  constructor(
    private readonly options: SeedOptions,
    private readonly planner: SiteMessageSeedPlanner,
    private readonly repository: SiteMessageSeedRepository,
  ) {
    this.writeUpdates = {
      [SeedMode.KEEP_EDITS]: values => this.repository.updateSeedOwned(values),
      [SeedMode.OVERWRITE]: values => this.repository.resetToDefaults(values),
    };
  }

  async run(): Promise<void> {
    const mode = this.options.mode();
    const plan = this.planner.plan(await this.repository.findAll(), mode);
    if (plan.creates.length > 0) {
      await this.repository.createDefaults(plan.creates);
    }
    if (plan.updates.length > 0) {
      await this.writeUpdates[mode](plan.updates);
    }
    this.report(plan, mode);
  }

  private report(plan: SiteMessageSeedPlan, mode: SeedMode): void {
    this.logger.log('SiteMessagesSeed : messages', {
      keys: this.planner.keyCount(),
      locales: LocaleMap.LOCALES.length,
      created: plan.creates.length,
      updated: plan.updates.length,
      kept_edited: plan.keptEdited,
      mode,
    });
    this.reportOrphans(plan.orphans);
  }

  private reportOrphans(orphans: readonly string[]): void {
    if (orphans.length === 0) {
      return;
    }
    this.logger.warn('SiteMessagesSeed : orphan rows not in shared/messages (kept, unused)', {
      orphans: orphans.length,
      listed: orphans.slice(0, SiteMessagesSeed.ORPHANS_LISTED).join(', '),
      more: Math.max(0, orphans.length - SiteMessagesSeed.ORPHANS_LISTED),
    });
  }
}
