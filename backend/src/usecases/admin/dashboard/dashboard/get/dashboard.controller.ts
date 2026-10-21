import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { UserRole } from '~core/users/user-role';
import { Roles } from '~decorator';

import { DashboardResponse } from './dashboard.response';
import { DASHBOARD_ROUTE } from './dashboard.route';
import { DashboardUsecase } from './dashboard.usecase';

@ApiBearerAuth()
@Roles([UserRole.ADMIN])
@Controller()
export class DashboardController {
  constructor(private readonly usecase: DashboardUsecase) {}

  @ApiTags('admin')
  @ApiOperation({
    summary: 'Дашборд',
    description: 'Счётчики разделов (всего / на сайте), медиатека, тексты сайта, заявки и 5 последних заявок.',
  })
  @ApiOkResponse({ type: DashboardResponse })
  @Get(DASHBOARD_ROUTE)
  async execute(): Promise<DashboardResponse> {
    return this.usecase.execute();
  }
}
