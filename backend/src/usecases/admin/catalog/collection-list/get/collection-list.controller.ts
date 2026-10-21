import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { UserRole } from '~core/users/user-role';
import { Roles } from '~decorator';

import { CollectionListResponse } from './collection-list.response';
import { COLLECTION_LIST_ROUTE } from './collection-list.route';
import { CollectionListUsecase } from './collection-list.usecase';

@ApiBearerAuth()
@Roles([UserRole.ADMIN])
@Controller()
export class CollectionListController {
  constructor(private readonly usecase: CollectionListUsecase) {}

  @ApiTags('admin')
  @ApiOperation({ summary: 'Коллекции', description: 'Все коллекции в порядке сайта: обложка, число товаров.' })
  @ApiOkResponse({ type: CollectionListResponse })
  @Get(COLLECTION_LIST_ROUTE)
  async execute(): Promise<CollectionListResponse> {
    return this.usecase.execute();
  }
}
