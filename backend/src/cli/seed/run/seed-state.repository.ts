import { Injectable } from '@nestjs/common';

import { DatabaseService } from '~database';

/** Whether the database was seeded before: the site settings row is written last by a successful full seed. */
@Injectable()
export class SeedStateRepository {
  private static readonly SETTINGS_ID = 1;

  constructor(private readonly database: DatabaseService) {}

  async isSeeded(): Promise<boolean> {
    const settings = await this.database.client.siteSettings.count({ where: { id: SeedStateRepository.SETTINGS_ID } });
    return settings > 0;
  }
}
