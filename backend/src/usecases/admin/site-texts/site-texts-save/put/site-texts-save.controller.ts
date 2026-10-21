import { Body, Controller, HttpCode, HttpStatus, Put } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { UserRole } from '~core/users/user-role';
import { Roles } from '~decorator';

import { SiteTextsSaveDto } from './site-texts-save.dto';
import { SiteTextsSaveResponse } from './site-texts-save.response';
import { SITE_TEXTS_SAVE_ROUTE } from './site-texts-save.route';
import { SiteTextsSaveUsecase } from './site-texts-save.usecase';

@ApiBearerAuth()
@Roles([UserRole.ADMIN])
@Controller()
export class SiteTextsSaveController {
  constructor(private readonly usecase: SiteTextsSaveUsecase) {}

  @ApiTags('admin')
  @ApiOperation({
    summary: 'Сохранить тексты сайта',
    description:
      'Сохраняет изменённые тексты и картинки лендинга с проверкой: правка должна начинаться с того, что сейчас сохранено.',
  })
  @ApiOkResponse({ type: SiteTextsSaveResponse })
  @ApiBadRequestResponse({
    description:
      'error: validation — shape (admin.validation.*), texts ("" = admin.siteTexts.errors.fixErrors, "<key>.<locale>" …) or a deleted image ("" = admin.errors.missingMedia)',
  })
  @ApiConflictResponse({
    description:
      'error: conflict (admin.siteTexts.errors.conflict), details: "<key>.<locale>" → stored text, "<image key>" → true',
  })
  @HttpCode(HttpStatus.OK)
  @Put(SITE_TEXTS_SAVE_ROUTE)
  async execute(@Body() dto: SiteTextsSaveDto): Promise<SiteTextsSaveResponse> {
    return this.usecase.execute({ entries: dto.entries, images: dto.images });
  }
}
