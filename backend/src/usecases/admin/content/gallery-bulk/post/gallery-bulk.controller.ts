import { Body, Controller, Post } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { UserRole } from '~core/users/user-role';
import { Roles } from '~decorator';

import { GalleryBulkDto } from './gallery-bulk.dto';
import { GalleryBulkResponse } from './gallery-bulk.response';
import { GALLERY_BULK_ROUTE } from './gallery-bulk.route';
import { GalleryBulkUsecase } from './gallery-bulk.usecase';

@ApiBearerAuth()
@Roles([UserRole.ADMIN])
@Controller()
export class GalleryBulkController {
  constructor(private readonly usecase: GalleryBulkUsecase) {}

  @ApiTags('admin')
  @ApiOperation({
    summary: 'Несколько фото в галерею',
    description: 'Добавляет до 100 фото в конец галереи, без подписей.',
  })
  @ApiCreatedResponse({ type: GalleryBulkResponse })
  @ApiBadRequestResponse({ description: 'error: validation | badRequest (admin.errors.missingMedia)' })
  @Post(GALLERY_BULK_ROUTE)
  async execute(@Body() dto: GalleryBulkDto): Promise<GalleryBulkResponse> {
    return this.usecase.execute({ mediaIds: dto.mediaIds, published: dto.published });
  }
}
