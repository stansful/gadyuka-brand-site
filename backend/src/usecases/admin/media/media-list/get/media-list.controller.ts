import { Controller, Get, Query } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { UserRole } from '~core/users/user-role';
import { Roles } from '~decorator';

import { MediaListDto } from './media-list.dto';
import { MediaListResponse } from './media-list.response';
import { MEDIA_LIST_ROUTE } from './media-list.route';
import { MediaListUsecase } from './media-list.usecase';

@ApiBearerAuth()
@Roles([UserRole.ADMIN])
@Controller()
export class MediaListController {
  constructor(private readonly usecase: MediaListUsecase) {}

  @ApiTags('admin')
  @ApiOperation({ summary: 'Медиатека', description: 'Файлы, новые первыми, по 60; поиск по имени файла.' })
  @ApiOkResponse({ type: MediaListResponse })
  @ApiBadRequestResponse({ description: 'error: validation (cursor: admin.media.errors.badCursor)' })
  @Get(MEDIA_LIST_ROUTE)
  async execute(@Query() dto: MediaListDto): Promise<MediaListResponse> {
    return this.usecase.execute({ cursor: dto.cursor, search: dto.q });
  }
}
