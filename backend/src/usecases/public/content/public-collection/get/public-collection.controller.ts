import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBadRequestResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from '~decorator';

import { PublicCollectionQueryDto } from './public-collection-query.dto';
import { PublicCollectionDto } from './public-collection.dto';
import { PublicCollectionResponse } from './public-collection.response';
import { PUBLIC_COLLECTION_ROUTE } from './public-collection.route';
import { PublicCollectionUsecase } from './public-collection.usecase';

@Controller()
export class PublicCollectionController {
  constructor(private readonly usecase: PublicCollectionUsecase) {}

  @ApiTags('public')
  @ApiOperation({
    summary: 'Коллекция',
    description: 'Опубликованная коллекция с опубликованными товарами на языке (страница /catalog/<slug>).',
  })
  @ApiOkResponse({ type: PublicCollectionResponse })
  @ApiBadRequestResponse({ description: 'error: validation (slug, locale: admin.validation.*)' })
  @ApiNotFoundResponse({ description: 'error: notFound (admin.errors.notFound) — no such slug, or hidden' })
  @Public()
  @Get(PUBLIC_COLLECTION_ROUTE)
  async execute(
    @Param() params: PublicCollectionDto,
    @Query() query: PublicCollectionQueryDto,
  ): Promise<PublicCollectionResponse> {
    return this.usecase.execute({ slug: params.slug, locale: query.locale });
  }
}
