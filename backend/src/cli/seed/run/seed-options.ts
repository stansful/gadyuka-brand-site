import { Injectable } from '@nestjs/common';

import { ConfigService } from '~config';

import { SeedMode } from './seed-mode.enum';

/** Options of `npm run db:seed` from the environment: `SEED_OVERWRITE=1` resets every seeded row. */
@Injectable()
export class SeedOptions {
  private static readonly OVERWRITE_VARIABLE = 'SEED_OVERWRITE';
  /** Exactly "1" (as in the frontend seed); anything else keeps the admin's edits. */
  private static readonly OVERWRITE_ON = '1';

  private readonly seedMode: SeedMode;

  constructor(config: ConfigService) {
    const flag = config.get(SeedOptions.OVERWRITE_VARIABLE);
    this.seedMode = flag === SeedOptions.OVERWRITE_ON ? SeedMode.OVERWRITE : SeedMode.KEEP_EDITS;
  }

  mode(): SeedMode {
    return this.seedMode;
  }
}
