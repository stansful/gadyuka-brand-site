import { Controller, Get, Query } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { UserRole } from '~core/users/user-role';
import { Roles } from '~decorator';

import { LeadListDto } from './lead-list.dto';
import { LeadListResponse } from './lead-list.response';
import { LEAD_LIST_ROUTE } from './lead-list.route';
import { LeadListUsecase } from './lead-list.usecase';

@ApiBearerAuth()
@Roles([UserRole.ADMIN])
@Controller()
export class LeadListController {
  constructor(private readonly usecase: LeadListUsecase) {}

  @ApiTags('admin')
  @ApiOperation({
    summary: 'Заявки',
    description: 'Список заявок с фильтрами по типу и статусу, 25 на странице, новые сверху.',
  })
  @ApiOkResponse({ type: LeadListResponse })
  @ApiBadRequestResponse({ description: 'error: validation (type, status, page: admin.validation.invalid)' })
  @Get(LEAD_LIST_ROUTE)
  async execute(@Query() dto: LeadListDto): Promise<LeadListResponse> {
    return this.usecase.execute({ type: dto.type, status: dto.status, page: dto.page });
  }
}
