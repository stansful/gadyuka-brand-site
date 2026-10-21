import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
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

import { SiteTextsResetDto } from './site-texts-reset.dto';
import { SiteTextsResetResponse } from './site-texts-reset.response';
import { SITE_TEXTS_RESET_ROUTE } from './site-texts-reset.route';
import { SiteTextsResetUsecase } from './site-texts-reset.usecase';

@ApiBearerAuth()
@Roles([UserRole.ADMIN])
@Controller()
export class SiteTextsResetController {
  constructor(private readonly usecase: SiteTextsResetUsecase) {}

  @ApiTags('admin')
  @ApiOperation({
    summary: 'Вернуть текст по умолчанию',
    description: 'Текст получает исходное значение shared/messages на всех языках (метка «изменено» снимается).',
  })
  @ApiOkResponse({ type: SiteTextsResetResponse })
  @ApiBadRequestResponse({ description: 'error: validation (key: admin.siteTexts.errors.unknownKey)' })
  @ApiNotFoundResponse({ description: 'error: notFound (admin.siteTexts.errors.unknownKey) — no such site text' })
  @HttpCode(HttpStatus.OK)
  @Post(SITE_TEXTS_RESET_ROUTE)
  async execute(@Body() dto: SiteTextsResetDto): Promise<SiteTextsResetResponse> {
    return this.usecase.execute({ key: dto.key });
  }
}
