import { ApiProperty } from '@nestjs/swagger';

import type { VisitsRecentResponse, VisitRecentItem } from '~shared/contracts/visits';

class VisitRecentItemResponse implements VisitRecentItem {
  @ApiProperty()
  firstAt: string;

  @ApiProperty()
  lastAt: string;

  @ApiProperty({ nullable: true })
  path: string | null;

  @ApiProperty({ nullable: true })
  userAgent: string | null;
}

/** Answer of GET /admin/visits/recent. */
export class VisitsRecentResponseBody implements VisitsRecentResponse {
  @ApiProperty({ type: () => [VisitRecentItemResponse] })
  visits: readonly VisitRecentItemResponse[];

  static of(visits: readonly VisitRecentItem[]): VisitsRecentResponseBody {
    return Object.assign(new VisitsRecentResponseBody(), { visits });
  }
}
