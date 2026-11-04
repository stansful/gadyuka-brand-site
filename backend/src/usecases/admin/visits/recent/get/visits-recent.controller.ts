import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { UserRole } from '~core/users/user-role';
import { Roles } from '~decorator';

import { VisitsRecentResponseBody } from './visits-recent.response';
import { VISITS_RECENT_ROUTE } from './visits-recent.route';
import { VisitsRecentUsecase } from './visits-recent.usecase';

@ApiBearerAuth()
@Roles([UserRole.ADMIN])
@Controller()
export class VisitsRecentController {
  constructor(private readonly usecase: VisitsRecentUsecase) {}

  @ApiTags('admin')
  @ApiOperation({ summary: 'Последние визиты', description: 'Список последних уникальных посещений.' })
  @ApiOkResponse({ type: VisitsRecentResponseBody })
  @Get(VISITS_RECENT_ROUTE)
  async execute(@Query('limit') limit?: string): Promise<VisitsRecentResponseBody> {
    const parsed = limit ? Number(limit) : undefined;
    return VisitsRecentResponseBody.of((await this.usecase.execute(parsed)).visits);
  }
}
