import { ApiProperty } from '@nestjs/swagger';

import type { DashboardNewLeadsResponse as DashboardNewLeadsResponseContract } from '~shared/contracts/dashboard';

/** Answer of GET /admin/dashboard/new-leads (the badge of the sidebar). */
export class DashboardNewLeadsResponse implements DashboardNewLeadsResponseContract {
  @ApiProperty({ description: 'Leads with status NEW', example: 3 })
  count: number;

  static of(count: number): DashboardNewLeadsResponse {
    return Object.assign(new DashboardNewLeadsResponse(), { count });
  }
}
