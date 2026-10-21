import { Body, Controller, Param, Put } from '@nestjs/common';
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
import { ContentEntitySavedResponse } from '~usecases/admin/content/common/content-entity-saved.response';
import { GalleryItemInputDto } from '~usecases/admin/content/common/gallery/gallery-item-input.dto';

import { GALLERY_UPDATE_ROUTE } from './gallery-update.route';
import { GalleryUpdateUsecase } from './gallery-update.usecase';

@ApiBearerAuth()
@Roles([UserRole.ADMIN])
@Controller()
export class GalleryUpdateController {
  constructor(private readonly usecase: GalleryUpdateUsecase) {}

  @ApiTags('admin')
  @ApiOperation({ summary: 'Сохранить фото галереи', description: 'Форма редактирования фото галереи.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ContentEntitySavedResponse })
  @ApiBadRequestResponse({ description: 'error: validation | badRequest (admin.errors.invalidId, missingMedia)' })
  @ApiNotFoundResponse({ description: 'error: notFound (admin.errors.notFound)' })
  @Put(GALLERY_UPDATE_ROUTE)
  async execute(
    @Param('id', RowIdPipe) id: string,
    @Body() dto: GalleryItemInputDto,
  ): Promise<ContentEntitySavedResponse> {
    return this.usecase.execute({ id, mediaId: dto.mediaId, caption: dto.caption, published: dto.published });
  }
}
