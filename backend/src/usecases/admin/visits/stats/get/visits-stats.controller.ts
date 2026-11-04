import { Controller, Get, Query } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { UserRole } from '~core/users/user-role';
import { Roles } from '~decorator';

import { VisitsStatsDto } from './visits-stats.dto';
import { VisitsStatsResponseBody } from './visits-stats.response';
import { VISITS_STATS_ROUTE } from './visits-stats.route';
import { VisitsStatsUsecase } from './visits-stats.usecase';

@ApiBearerAuth()
@Roles([UserRole.ADMIN])
@Controller()
export class VisitsStatsController {
  constructor(private readonly usecase: VisitsStatsUsecase) {}

  @ApiTags('admin')
  @ApiOperation({ summary: 'Статистика посещений', description: 'Уникальные посетители за период, по дням или часам.' })
  @ApiOkResponse({ type: VisitsStatsResponseBody })
  @ApiBadRequestResponse({ description: 'error: validation (from, to, granularity)' })
  @Get(VISITS_STATS_ROUTE)
  async execute(@Query() dto: VisitsStatsDto): Promise<VisitsStatsResponseBody> {
    const { points, total } = await this.usecase.execute({
      from: dto.from,
      to: dto.to,
      granularity: dto.granularity,
    });
    return VisitsStatsResponseBody.of(points, total);
  }
}
