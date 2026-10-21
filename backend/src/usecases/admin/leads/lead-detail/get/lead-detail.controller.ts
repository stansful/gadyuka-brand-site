import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { UserRole } from '~core/users/user-role';
import { Roles } from '~decorator';
import { LeadIdParamsDto } from '~usecases/admin/leads/common/lead-id-params.dto';

import { LeadDetailResponse } from './lead-detail.response';
import { LEAD_DETAIL_ROUTE } from './lead-detail.route';
import { LeadDetailUsecase } from './lead-detail.usecase';

@ApiBearerAuth()
@Roles([UserRole.ADMIN])
@Controller()
export class LeadDetailController {
  constructor(private readonly usecase: LeadDetailUsecase) {}

  @ApiTags('admin')
  @ApiOperation({
    summary: 'Заявка',
    description: 'Контакты, сообщение, служебные данные и статус Telegram одной заявки.',
  })
  @ApiOkResponse({ type: LeadDetailResponse })
  @ApiBadRequestResponse({ description: 'error: validation (id: admin.validation.idInvalid)' })
  @ApiNotFoundResponse({ description: 'error: notFound (admin.leads.notFound)' })
  @Get(LEAD_DETAIL_ROUTE)
  async execute(@Param() params: LeadIdParamsDto): Promise<LeadDetailResponse> {
    return this.usecase.execute({ id: params.id });
  }
}
