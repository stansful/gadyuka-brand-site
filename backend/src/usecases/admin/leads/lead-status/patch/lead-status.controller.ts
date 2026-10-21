import { Body, Controller, Param, Patch } from '@nestjs/common';
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

import { LeadStatusDto } from './lead-status.dto';
import { LeadStatusResponse } from './lead-status.response';
import { LEAD_STATUS_ROUTE } from './lead-status.route';
import { LeadStatusUsecase } from './lead-status.usecase';

@ApiBearerAuth()
@Roles([UserRole.ADMIN])
@Controller()
export class LeadStatusController {
  constructor(private readonly usecase: LeadStatusUsecase) {}

  @ApiTags('admin')
  @ApiOperation({ summary: 'Статус заявки', description: 'Новая / В работе / Готово / Спам — сохраняется сразу.' })
  @ApiOkResponse({ type: LeadStatusResponse })
  @ApiBadRequestResponse({
    description: 'error: validation (id: admin.validation.idInvalid, status: admin.validation.invalid)',
  })
  @ApiNotFoundResponse({ description: 'error: notFound (admin.errors.notFound)' })
  @Patch(LEAD_STATUS_ROUTE)
  async execute(@Param() params: LeadIdParamsDto, @Body() dto: LeadStatusDto): Promise<LeadStatusResponse> {
    return this.usecase.execute({ id: params.id, status: dto.status });
  }
}
