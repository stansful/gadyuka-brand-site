import { Controller, Get, Query } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { UserRole } from '~core/users/user-role';
import { Roles } from '~decorator';

import { SiteTextsPageDto } from './site-texts-page.dto';
import { SiteTextsPageResponse } from './site-texts-page.response';
import { SITE_TEXTS_PAGE_ROUTE } from './site-texts-page.route';
import { SiteTextsPageUsecase } from './site-texts-page.usecase';

@ApiBearerAuth()
@Roles([UserRole.ADMIN])
@Controller()
export class SiteTextsPageController {
  constructor(private readonly usecase: SiteTextsPageUsecase) {}

  @ApiTags('admin')
  @ApiOperation({
    summary: 'Тексты сайта',
    description:
      'Разделы со счётчиками и тексты одного раздела (с картинками лендинга) или результаты поиска ?q по всем разделам.',
  })
  @ApiOkResponse({ type: SiteTextsPageResponse })
  @ApiBadRequestResponse({ description: 'error: validation (section / q: admin.validation.invalid)' })
  @Get(SITE_TEXTS_PAGE_ROUTE)
  async execute(@Query() dto: SiteTextsPageDto): Promise<SiteTextsPageResponse> {
    return this.usecase.execute({ section: dto.section, query: dto.q });
  }
}
