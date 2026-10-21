import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import { UserRole } from '~core/users/user-role';
import { Roles } from '~decorator';
import { RowIdPipe } from '~usecases/admin/common/row-id.pipe';
import { NewsDetailsResponse } from '~usecases/admin/content/common/news/news-details.response';

import { NEWS_DETAILS_ROUTE } from './news-details.route';
import { NewsDetailsUsecase } from './news-details.usecase';

@ApiBearerAuth()
@Roles([UserRole.ADMIN])
@Controller()
export class NewsDetailsController {
  constructor(private readonly usecase: NewsDetailsUsecase) {}

  @ApiTags('admin')
  @ApiOperation({ summary: 'Новость', description: 'Новость для формы редактирования.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: NewsDetailsResponse })
  @ApiBadRequestResponse({ description: 'error: badRequest (admin.errors.invalidId)' })
  @ApiNotFoundResponse({ description: 'error: notFound (admin.errors.notFound)' })
  @Get(NEWS_DETAILS_ROUTE)
  async execute(@Param('id', RowIdPipe) id: string): Promise<NewsDetailsResponse> {
    return this.usecase.execute({ id });
  }
}
