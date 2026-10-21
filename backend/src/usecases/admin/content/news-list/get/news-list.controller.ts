import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { UserRole } from '~core/users/user-role';
import { Roles } from '~decorator';

import { NewsListResponse } from './news-list.response';
import { NEWS_LIST_ROUTE } from './news-list.route';
import { NewsListUsecase } from './news-list.usecase';

@ApiBearerAuth()
@Roles([UserRole.ADMIN])
@Controller()
export class NewsListController {
  constructor(private readonly usecase: NewsListUsecase) {}

  @ApiTags('admin')
  @ApiOperation({ summary: 'Новости', description: 'Все новости для списка админки: по дате, новые сверху.' })
  @ApiOkResponse({ type: NewsListResponse })
  @Get(NEWS_LIST_ROUTE)
  async execute(): Promise<NewsListResponse> {
    return this.usecase.execute();
  }
}
