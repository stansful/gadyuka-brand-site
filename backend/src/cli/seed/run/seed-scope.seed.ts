import { Injectable, Logger } from '@nestjs/common';

import { SeedStep } from '../seed-step.interface';
import { SeedMode } from './seed-mode.enum';
import { SeedOptions } from './seed-options';
import { SeedRun } from './seed-run';
import { SeedScope } from './seed-scope.enum';
import { SeedStateRepository } from './seed-state.repository';

/**
 * Decides what this run seeds, before any content is written: everything on a first run (no site
 * settings row yet) or with SEED_OVERWRITE=1; otherwise only the images of new content image keys — the
 * demo entities of a seeded database belong to the admin.
 */
@Injectable()
export class SeedScopeSeed implements SeedStep {
  private readonly logger = new Logger(SeedScopeSeed.name);
  private readonly scopeOf: Readonly<Record<SeedMode, () => Promise<SeedScope>>>;

  constructor(
    private readonly options: SeedOptions,
    private readonly state: SeedStateRepository,
    private readonly seedRun: SeedRun,
  ) {
    this.scopeOf = {
      [SeedMode.KEEP_EDITS]: async () => ((await this.state.isSeeded()) ? SeedScope.NEW_IMAGE_KEYS : SeedScope.FULL),
      [SeedMode.OVERWRITE]: async () => SeedScope.FULL,
    };
  }

  async run(): Promise<void> {
    const mode = this.options.mode();
    const scope = await this.scopeOf[mode]();
    this.seedRun.start(scope);
    this.logger.log('SeedScopeSeed : seeding', { mode, scope });
  }
}
