import { ApiProperty } from '@nestjs/swagger';

import type { VisitsStatsPoint, VisitsStatsResponse } from '~shared/contracts/visits';

class VisitsStatsPointResponse implements VisitsStatsPoint {
  @ApiProperty({ description: 'ISO bucket start: date for day granularity, hour for hour granularity' })
  bucket: string;

  @ApiProperty({ description: 'Unique visitors in this bucket' })
  count: number;
}

/** Answer of GET /admin/visits/stats. */
export class VisitsStatsResponseBody implements VisitsStatsResponse {
  @ApiProperty({ type: () => [VisitsStatsPointResponse] })
  points: readonly VisitsStatsPointResponse[];

  @ApiProperty({ description: 'Unique visitors across the whole period' })
  total: number;

  static of(points: readonly VisitsStatsPoint[], total: number): VisitsStatsResponseBody {
    return Object.assign(new VisitsStatsResponseBody(), { points, total });
  }
}
