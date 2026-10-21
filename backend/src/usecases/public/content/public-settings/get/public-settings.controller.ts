import { Controller, Get, Param } from '@nestjs/common';
import { ApiBadRequestResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from '~decorator';

import { PublicSettingsDto } from './public-settings.dto';
import { PublicSettingsResponse } from './public-settings.response';
import { PUBLIC_SETTINGS_ROUTE } from './public-settings.route';
import { PublicSettingsUsecase } from './public-settings.usecase';

@Controller()
export class PublicSettingsController {
  constructor(private readonly usecase: PublicSettingsUsecase) {}

  @ApiTags('public')
  @ApiOperation({
    summary: 'Настройки сайта',
    description: 'Контакты, шкала оценок отзывов и SEO по умолчанию на языке (метаданные страниц, манифест).',
  })
  @ApiOkResponse({ type: PublicSettingsResponse })
  @ApiBadRequestResponse({ description: 'error: validation (locale: admin.validation.invalid)' })
  @Public()
  @Get(PUBLIC_SETTINGS_ROUTE)
  async execute(@Param() dto: PublicSettingsDto): Promise<PublicSettingsResponse> {
    return this.usecase.execute({ locale: dto.locale });
  }
}
