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
import { GalleryItemDetailsResponse } from '~usecases/admin/content/common/gallery/gallery-item-details.response';

import { GALLERY_DETAILS_ROUTE } from './gallery-details.route';
import { GalleryDetailsUsecase } from './gallery-details.usecase';

@ApiBearerAuth()
@Roles([UserRole.ADMIN])
@Controller()
export class GalleryDetailsController {
  constructor(private readonly usecase: GalleryDetailsUsecase) {}

  @ApiTags('admin')
  @ApiOperation({ summary: 'Фото галереи', description: 'Фото галереи для формы редактирования.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: GalleryItemDetailsResponse })
  @ApiBadRequestResponse({ description: 'error: badRequest (admin.errors.invalidId)' })
  @ApiNotFoundResponse({ description: 'error: notFound (admin.errors.notFound)' })
  @Get(GALLERY_DETAILS_ROUTE)
  async execute(@Param('id', RowIdPipe) id: string): Promise<GalleryItemDetailsResponse> {
    return this.usecase.execute({ id });
  }
}
