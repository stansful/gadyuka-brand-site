import { Injectable } from '@nestjs/common';

import { DatabaseService } from '~database';

@Injectable()
export class HealthRepository {
  constructor(private readonly database: DatabaseService) {}

  /** Throws when the database does not answer. */
  async pingDatabase(): Promise<void> {
    await this.database.client.$queryRaw`SELECT 1`;
  }
}
