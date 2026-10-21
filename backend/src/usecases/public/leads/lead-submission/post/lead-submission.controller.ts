import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';

import { ClientIp, Public, UserAgent } from '~decorator';

import { LeadSubmissionDto } from './lead-submission.dto';
import { LeadSubmissionResponse } from './lead-submission.response';
import { LEAD_SUBMISSION_ROUTE } from './lead-submission.route';
import { LeadSubmissionUsecase } from './lead-submission.usecase';

@Controller()
export class LeadSubmissionController {
  constructor(private readonly usecase: LeadSubmissionUsecase) {}

  @ApiTags('public')
  @ApiOperation({
    summary: 'Заявка с формы сайта',
    description:
      'Пошив / сотрудничество / «Связаться»: проверка, лимит 5 заявок за 10 минут с сети посетителя ' +
      '(x-client-ip), сохранение, уведомление владельцу в Telegram после ответа. Заполненная ловушка (hp) → 201 без сохранения.',
  })
  @ApiCreatedResponse({ type: LeadSubmissionResponse })
  @ApiBadRequestResponse({
    description:
      'error: validation — fields type | name | email | phone | message | consent | contact, keys forms.errors.*',
  })
  @ApiTooManyRequestsResponse({
    description: 'error: throttled (forms.errors.rateLimited), details: { retryAfterSeconds }',
  })
  @Public()
  @Post(LEAD_SUBMISSION_ROUTE)
  async execute(
    @Body() dto: LeadSubmissionDto,
    @ClientIp() clientIp: string,
    @UserAgent() userAgent: string | undefined,
  ): Promise<LeadSubmissionResponse> {
    return this.usecase.execute({
      form: { type: dto.type, name: dto.name, email: dto.email, phone: dto.phone, message: dto.message },
      locale: dto.locale,
      honeypot: dto.hp,
      visitor: { clientIp, userAgent, referer: dto.referer },
    });
  }
}
