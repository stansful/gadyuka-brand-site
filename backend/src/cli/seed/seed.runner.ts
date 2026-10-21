import { Inject, Injectable, Logger } from '@nestjs/common';

import { SeedStep } from './seed-step.interface';
import { SEED_STEP_LIST } from './seed.constants';

/** Runs the seed steps of seed.steps.ts in order (a failing step stops the seed: exit code 1). */
@Injectable()
export class SeedRunner {
  private readonly logger = new Logger(SeedRunner.name);

  constructor(@Inject(SEED_STEP_LIST) private readonly steps: readonly SeedStep[]) {}

  async run(): Promise<void> {
    for (const step of this.steps) {
      this.logger.log('SeedRunner : step', { step: step.constructor.name });
      await step.run();
    }
  }
}
