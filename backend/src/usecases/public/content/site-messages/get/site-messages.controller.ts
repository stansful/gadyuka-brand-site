import { Controller, Get, Param } from '@nestjs/common';
import { ApiBadRequestResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from '~decorator';

import { SiteMessagesDto } from './site-messages.dto';
import { SiteMessagesResponse } from './site-messages.response';
import { SITE_MESSAGES_ROUTE } from './site-messages.route';
import { SiteMessagesUsecase } from './site-messages.usecase';

@Controller()
export class SiteMessagesController {
  constructor(private readonly usecase: SiteMessagesUsecase) {}

  @ApiTags('public')
  @ApiOperation({
    summary: 'Тексты сайта',
    description: 'Все тексты интерфейса сайта на языке: правки админки поверх shared/messages.',
  })
  @ApiOkResponse({ type: SiteMessagesResponse })
  @ApiBadRequestResponse({ description: 'error: validation (locale: admin.validation.invalid)' })
  @Public()
  @Get(SITE_MESSAGES_ROUTE)
  async execute(@Param() dto: SiteMessagesDto): Promise<SiteMessagesResponse> {
    return this.usecase.execute({ locale: dto.locale });
  }
}
