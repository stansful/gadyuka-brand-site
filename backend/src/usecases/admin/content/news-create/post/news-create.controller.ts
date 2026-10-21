import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { UserRole } from '~core/users/user-role';
import { Roles } from '~decorator';
import { ContentEntitySavedResponse } from '~usecases/admin/content/common/content-entity-saved.response';
import { NewsInputDto } from '~usecases/admin/content/common/news/news-input.dto';

import { NEWS_CREATE_ROUTE } from './news-create.route';
import { NewsCreateUsecase } from './news-create.usecase';

@ApiBearerAuth()
@Roles([UserRole.ADMIN])
@Controller()
export class NewsCreateController {
  constructor(private readonly usecase: NewsCreateUsecase) {}

  @ApiTags('admin')
  @ApiOperation({ summary: 'Новая новость', description: 'Создаёт новость; дата хранится как полдень по Москве.' })
  @ApiCreatedResponse({ type: ContentEntitySavedResponse })
  @ApiBadRequestResponse({ description: 'error: validation | badRequest (admin.errors.missingMedia)' })
  @ApiConflictResponse({ description: 'error: conflict (admin.errors.slugTaken)' })
  @Post(NEWS_CREATE_ROUTE)
  async execute(@Body() dto: NewsInputDto): Promise<ContentEntitySavedResponse> {
    return this.usecase.execute({
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
