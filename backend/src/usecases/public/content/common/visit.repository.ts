import { Injectable } from '@nestjs/common';

import { DatabaseService } from '~database';
import { Prisma } from '~prisma-generated/prisma/client';

export interface UpsertVisit {
  readonly hourBucket: Date;
  readonly ipHash: string;
  readonly userAgent: string | null;
  readonly path: string | null;
}

export interface VisitStatsRow {
  readonly bucket: Date;
  readonly count: number;
}

export interface VisitRecentRow {
  readonly firstAt: Date;
  readonly lastAt: Date;
  readonly path: string | null;
  readonly userAgent: string | null;
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

  async countUniqueByDay(from: Date, to: Date): Promise<VisitStatsRow[]> {
    return this.database.client.$queryRaw<VisitStatsRow[]>(
      Prisma.sql`
        SELECT date_trunc('day', "hour_bucket")::date AS bucket,
               COUNT(DISTINCT "ip_hash")::int       AS count
        FROM visits
        WHERE "hour_bucket" >= ${from}
          AND "hour_bucket" <= ${to}
        GROUP BY bucket
        ORDER BY bucket ASC
      `,
    );
  }

  async countUniqueByHour(from: Date, to: Date): Promise<VisitStatsRow[]> {
    return this.database.client.$queryRaw<VisitStatsRow[]>(
      Prisma.sql`
        SELECT date_trunc('hour', "hour_bucket") AS bucket,
               COUNT(DISTINCT "ip_hash")::int   AS count
        FROM visits
        WHERE "hour_bucket" >= ${from}
          AND "hour_bucket" <= ${to}
        GROUP BY bucket
        ORDER BY bucket ASC
      `,
    );
  }

  async countUniqueTotal(from: Date, to: Date): Promise<number> {
    const rows = await this.database.client.$queryRaw<{ count: number }[]>(
      Prisma.sql`
        SELECT COUNT(DISTINCT "ip_hash")::int AS count
        FROM visits
        WHERE "hour_bucket" >= ${from}
          AND "hour_bucket" <= ${to}
      `,
    );
    return rows[0]?.count ?? 0;
  }

  async findRecent(limit: number): Promise<VisitRecentRow[]> {
    const visits = await this.database.client.visit.findMany({
      orderBy: { lastAt: 'desc' },
      take: limit,
      select: { firstAt: true, lastAt: true, path: true, userAgent: true },
    });
    return visits;
  }
}
