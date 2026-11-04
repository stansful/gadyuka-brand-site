import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { UserRole } from '~core/users/user-role';
import { Roles } from '~decorator';

import { ServerMetricsResponse } from './server-metrics.response';
import { SERVER_METRICS_ROUTE } from './server-metrics.route';
import { ServerMetricsUsecase } from './server-metrics.usecase';

@ApiBearerAuth()
@Roles([UserRole.ADMIN])
@Controller()
export class ServerMetricsController {
  constructor(private readonly usecase: ServerMetricsUsecase) {}

  @ApiTags('admin')
  @ApiOperation({ summary: 'Метрики сервера', description: 'CPU, RAM и дисковое пространство хоста' })
  @ApiOkResponse({ type: ServerMetricsResponse })
  @Get(SERVER_METRICS_ROUTE)
  async execute(): Promise<ServerMetricsResponse> {
    return this.usecase.execute();
  }
}
