import { Injectable } from '@nestjs/common';

import type { VisitsStatsPoint, VisitsStatsResponse, VisitGranularity } from '~shared/contracts/visits';

import { VisitRepository } from '~usecases/public/content/common/visit.repository';
import { Usecase } from '~usecases/usecase.interfaces';

export interface VisitsStatsCommand {
  readonly from: string;
  readonly to: string;
  readonly granularity: VisitGranularity;
}

@Injectable()
export class VisitsStatsUsecase implements Usecase<VisitsStatsCommand, VisitsStatsResponse> {
  constructor(private readonly visits: VisitRepository) {}

  async execute({ from, to, granularity }: VisitsStatsCommand): Promise<VisitsStatsResponse> {
    const start = dateStart(from);
    const end = dateEnd(to);
    const rows =
      granularity === 'hour'
        ? await this.visits.countUniqueByHour(start, end)
        : await this.visits.countUniqueByDay(start, end);

    const points: VisitsStatsPoint[] = rows.map(row => ({
      bucket: granularity === 'hour' ? toHourIso(row.bucket) : toDateIso(row.bucket),
      count: row.count,
    }));
    const total = await this.visits.countUniqueTotal(start, end);

    return { points, total };
  }
}

function dateStart(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

function dateEnd(date: string): Date {
  return new Date(`${date}T23:59:59.999Z`);
}

function toDateIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toHourIso(date: Date): string {
  return date.toISOString().slice(0, 13) + ':00:00.000Z';
}
