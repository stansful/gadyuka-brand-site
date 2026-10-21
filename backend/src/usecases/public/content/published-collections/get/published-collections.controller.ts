import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from '~decorator';

import { PublishedCollectionsResponse } from './published-collections.response';
import { PUBLISHED_COLLECTIONS_ROUTE } from './published-collections.route';
import { PublishedCollectionsUsecase } from './published-collections.usecase';

@Controller()
export class PublishedCollectionsController {
  constructor(private readonly usecase: PublishedCollectionsUsecase) {}

  @ApiTags('public')
  @ApiOperation({ summary: 'Коллекции', description: 'Адреса (slug) опубликованных коллекций в порядке админки.' })
  @ApiOkResponse({ type: PublishedCollectionsResponse })
  @Public()
  @Get(PUBLISHED_COLLECTIONS_ROUTE)
  async execute(): Promise<PublishedCollectionsResponse> {
    return this.usecase.execute();
  }
}
