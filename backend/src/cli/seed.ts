import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppLogger } from '~module/logger';

import { SeedModule } from './seed/seed.module';
import { SeedRunner } from './seed/seed.runner';

/**
 * `npm run db:seed`: idempotent database seed — the steps of seed/seed.steps.ts in order (the admin
 * account, the site texts, the seed images, the landing images and the demo content; `SEED_OVERWRITE=1`
 * resets every seeded row). Exit code 1 on failure.
 */
class SeedCli {
  private static readonly logger = new Logger(SeedCli.name);

  static async run(): Promise<void> {
    const app = await NestFactory.createApplicationContext(SeedModule, { bufferLogs: true });
    app.useLogger(app.get(AppLogger));
    try {
      await app.get(SeedRunner).run();
      SeedCli.logger.log('SeedCli : done');
    } finally {
      await app.close();
    }
  }

  static fail(error: unknown): void {
    SeedCli.logger.error(`SeedCli : failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

SeedCli.run().catch(SeedCli.fail);
