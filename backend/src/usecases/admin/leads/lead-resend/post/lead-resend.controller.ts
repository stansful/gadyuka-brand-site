import { Controller, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
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

import { LeadResendResponse } from './lead-resend.response';
import { LEAD_RESEND_ROUTE } from './lead-resend.route';
import { LeadResendUsecase } from './lead-resend.usecase';

@ApiBearerAuth()
@Roles([UserRole.ADMIN])
@Controller()
export class LeadResendController {
  constructor(private readonly usecase: LeadResendUsecase) {}

  @ApiTags('admin')
  @ApiOperation({
    summary: 'Отправить заявку в Telegram повторно',
    description: 'Отправляет заявку владельцу ещё раз и сохраняет результат (не доставлено — с причиной).',
  })
  @ApiOkResponse({ type: LeadResendResponse })
  @ApiBadRequestResponse({ description: 'error: validation (id: admin.validation.idInvalid)' })
  @ApiNotFoundResponse({ description: 'error: notFound (admin.leads.notFound)' })
  @HttpCode(HttpStatus.OK)
  @Post(LEAD_RESEND_ROUTE)
  async execute(@Param() params: LeadIdParamsDto): Promise<LeadResendResponse> {
    return this.usecase.execute({ id: params.id });
  }
}
