import { Injectable } from '@nestjs/common';

import { DatabaseService } from '~database';

export interface UpsertVisit {
  readonly hourBucket: Date;
  readonly ipHash: string;
  readonly userAgent: string | null;
  readonly path: string | null;
}

/**
 * Storage of public-page visits. One row per (hour, hashed visitor network); later requests in the same
 * hour only bump lastAt.
 */
@Injectable()
export class VisitRepository {
  constructor(private readonly database: DatabaseService) {}

  async upsert({ hourBucket, ipHash, userAgent, path }: UpsertVisit): Promise<void> {
    const now = new Date();
    await this.database.client.visit.upsert({
      where: { hourBucket_ipHash: { hourBucket, ipHash } },
      update: { lastAt: now },
      create: { hourBucket, ipHash, userAgent, path, firstAt: now, lastAt: now },
    });
  }
}
