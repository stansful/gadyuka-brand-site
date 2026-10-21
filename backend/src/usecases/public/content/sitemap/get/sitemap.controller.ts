import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from '~decorator';

import { SitemapResponse } from './sitemap.response';
import { SITEMAP_ROUTE } from './sitemap.route';
import { SitemapUsecase } from './sitemap.usecase';

@Controller()
export class SitemapController {
  constructor(private readonly usecase: SitemapUsecase) {}

  @ApiTags('public')
  @ApiOperation({
    summary: 'Карта сайта',
    description: 'Даты последних изменений лендинга и страниц опубликованных коллекций (sitemap.xml).',
  })
  @ApiOkResponse({ type: SitemapResponse })
  @Public()
  @Get(SITEMAP_ROUTE)
  async execute(): Promise<SitemapResponse> {
    return this.usecase.execute();
  }
}
