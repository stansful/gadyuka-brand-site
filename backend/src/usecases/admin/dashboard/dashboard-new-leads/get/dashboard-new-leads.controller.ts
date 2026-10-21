import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { UserRole } from '~core/users/user-role';
import { Roles } from '~decorator';

import { DashboardNewLeadsResponse } from './dashboard-new-leads.response';
import { DASHBOARD_NEW_LEADS_ROUTE } from './dashboard-new-leads.route';
import { DashboardNewLeadsUsecase } from './dashboard-new-leads.usecase';

@ApiBearerAuth()
@Roles([UserRole.ADMIN])
@Controller()
export class DashboardNewLeadsController {
  constructor(private readonly usecase: DashboardNewLeadsUsecase) {}

  @ApiTags('admin')
  @ApiOperation({ summary: 'Новые заявки', description: 'Число заявок со статусом NEW (значок в меню админки).' })
  @ApiOkResponse({ type: DashboardNewLeadsResponse })
  @Get(DASHBOARD_NEW_LEADS_ROUTE)
  async execute(): Promise<DashboardNewLeadsResponse> {
    return this.usecase.execute();
  }
}
