import { Body, Controller, Post } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { UserRole } from '~core/users/user-role';
import { Roles } from '~decorator';
import { ContentEntitySavedResponse } from '~usecases/admin/content/common/content-entity-saved.response';
import { GalleryItemInputDto } from '~usecases/admin/content/common/gallery/gallery-item-input.dto';

import { GALLERY_CREATE_ROUTE } from './gallery-create.route';
import { GalleryCreateUsecase } from './gallery-create.usecase';

@ApiBearerAuth()
@Roles([UserRole.ADMIN])
@Controller()
export class GalleryCreateController {
  constructor(private readonly usecase: GalleryCreateUsecase) {}

  @ApiTags('admin')
  @ApiOperation({ summary: 'Новое фото галереи', description: 'Добавляет фото в конец галереи.' })
  @ApiCreatedResponse({ type: ContentEntitySavedResponse })
  @ApiBadRequestResponse({ description: 'error: validation | badRequest (admin.errors.missingMedia)' })
  @Post(GALLERY_CREATE_ROUTE)
  async execute(@Body() dto: GalleryItemInputDto): Promise<ContentEntitySavedResponse> {
    return this.usecase.execute({ mediaId: dto.mediaId, caption: dto.caption, published: dto.published });
  }
}
