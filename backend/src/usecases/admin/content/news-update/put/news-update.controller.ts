import { Body, Controller, Param, Put } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import { UserRole } from '~core/users/user-role';
import { Roles } from '~decorator';
import { RowIdPipe } from '~usecases/admin/common/row-id.pipe';
import { ContentEntitySavedResponse } from '~usecases/admin/content/common/content-entity-saved.response';
import { NewsInputDto } from '~usecases/admin/content/common/news/news-input.dto';

import { NEWS_UPDATE_ROUTE } from './news-update.route';
import { NewsUpdateUsecase } from './news-update.usecase';

@ApiBearerAuth()
@Roles([UserRole.ADMIN])
@Controller()
export class NewsUpdateController {
  constructor(private readonly usecase: NewsUpdateUsecase) {}

  @ApiTags('admin')
  @ApiOperation({ summary: 'Сохранить новость', description: 'Форма редактирования новости.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ContentEntitySavedResponse })
  @ApiBadRequestResponse({ description: 'error: validation | badRequest (admin.errors.invalidId, missingMedia)' })
  @ApiConflictResponse({ description: 'error: conflict (admin.errors.slugTaken)' })
  @ApiNotFoundResponse({ description: 'error: notFound (admin.errors.notFound)' })
  @Put(NEWS_UPDATE_ROUTE)
  async execute(@Param('id', RowIdPipe) id: string, @Body() dto: NewsInputDto): Promise<ContentEntitySavedResponse> {
    return this.usecase.execute({
      id,
      slug: dto.slug,
      title: dto.title,
      excerpt: dto.excerpt,
      body: dto.body,
      date: dto.date,
      imageId: dto.imageId,
      published: dto.published,
    });
  }
}
