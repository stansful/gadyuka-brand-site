import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { UserRole } from '~core/users/user-role';
import { Roles } from '~decorator';

import { LeadTelegramStatusResponse } from './lead-telegram-status.response';
import { LEAD_TELEGRAM_STATUS_ROUTE } from './lead-telegram-status.route';
import { LeadTelegramStatusUsecase } from './lead-telegram-status.usecase';

@ApiBearerAuth()
@Roles([UserRole.ADMIN])
@Controller()
export class LeadTelegramStatusController {
  constructor(private readonly usecase: LeadTelegramStatusUsecase) {}

  @ApiTags('admin')
  @ApiOperation({
    summary: 'Уведомления о заявках',
    description:
      'Включён ли TELEGRAM_DRY_RUN (заявки сохраняются, но в Telegram не уходят) — для предупреждения в админке.',
  })
  @ApiOkResponse({ type: LeadTelegramStatusResponse })
  @Get(LEAD_TELEGRAM_STATUS_ROUTE)
  execute(): LeadTelegramStatusResponse {
    return this.usecase.execute();
  }
}
