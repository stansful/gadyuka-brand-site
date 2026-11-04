import { Injectable } from '@nestjs/common';

import type { VisitsRecentResponse } from '~shared/contracts/visits';

import { VisitRepository } from '~usecases/public/content/common/visit.repository';
import { Usecase } from '~usecases/usecase.interfaces';

@Injectable()
export class VisitsRecentUsecase implements Usecase<number, VisitsRecentResponse> {
  private static readonly DEFAULT_LIMIT = 20;

  constructor(private readonly visits: VisitRepository) {}

  async execute(limit = VisitsRecentUsecase.DEFAULT_LIMIT): Promise<VisitsRecentResponse> {
    const rows = await this.visits.findRecent(limit);
    return {
      visits: rows.map(row => ({
        firstAt: row.firstAt.toISOString(),
        lastAt: row.lastAt.toISOString(),
        path: row.path,
        userAgent: row.userAgent,
      })),
    };
  }
}
